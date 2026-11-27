import assert from 'node:assert/strict'
import type { SimConfig } from './config'
import type { ConsumerAgent, StorefrontDetail } from './consumer'
import { ApiError } from './http'
import type { MerchantAgent } from './merchant'
import { createRng, type Rng, sleep } from './random'
import type { ScenarioResult, Step } from './scenarios'
import { ensureBusiness, type SimBusiness, type Vertical } from './seed'

export interface TrafficOptions {
  orders?: number
  durationMs?: number
  concurrency: number
  failureRate: number
  ratePerSec?: number
  vertical: Vertical | 'mixed'
  seed?: number
  businessSlug?: string
  stepDelayMs: number
}

interface Stats {
  placed: number
  completed: number
  rejected: number
  cancelled: number
  lateCancelBlocked: number
  idempotentReplays: number
  errors: number
  latencies: number[]
}

const VERTICALS: Vertical[] = ['food', 'aircon', 'lpg']

export async function trafficScenario(
  ctx: { config: SimConfig; consumer: ConsumerAgent; merchant: MerchantAgent },
  options: TrafficOptions,
): Promise<ScenarioResult> {
  const rng = createRng(options.seed)
  const stats: Stats = {
    placed: 0,
    completed: 0,
    rejected: 0,
    cancelled: 0,
    lateCancelBlocked: 0,
    idempotentReplays: 0,
    errors: 0,
    latencies: [],
  }
  const finite = options.orders ?? (options.durationMs ? Number.POSITIVE_INFINITY : 50)
  const deadline = options.durationMs ? Date.now() + options.durationMs : Number.POSITIVE_INFINITY
  const active = new Set<Promise<void>>()
  let launched = 0
  let stopped = false

  const onSignal = () => {
    stopped = true
  }
  process.once('SIGINT', onSignal)

  try {
    while (!stopped && launched < finite && Date.now() < deadline) {
      if (active.size >= options.concurrency) {
        await Promise.race(active)
      }

      const vertical = options.vertical === 'mixed' ? rng.pick(VERTICALS) : options.vertical
      const business = await resolveBusiness(ctx, vertical, options)
      if (!business) {
        throw new Error(`No business available for ${vertical}`)
      }

      const detail = await ctx.consumer.storefront(business.slug)
      launched += 1
      const task = runOne(ctx, business, detail, rng, options, stats)
        .catch(() => {
          stats.errors += 1
        })
        .finally(() => active.delete(task))
      active.add(task)

      const rate = options.ratePerSec ?? 1
      const mean = 1_000 / Math.max(0.05, rate)
      await sleep(Math.round(mean * (0.6 + rng.next() * 0.8)))
    }

    await Promise.allSettled([...active])
  } finally {
    process.removeListener('SIGINT', onSignal)
  }

  const steps: Step[] = [
    {
      name: `${launched} random orders`,
      ok: stats.errors === 0,
      ms: Math.round(stats.latencies.reduce((a, b) => a + b, 0)),
    },
  ]
  const metrics = summarize(stats, launched, options)
  return {
    scenario: 'traffic',
    ok: stats.errors === 0,
    steps,
    metrics,
  }
}

async function resolveBusiness(
  ctx: { consumer: ConsumerAgent; merchant: MerchantAgent },
  vertical: Vertical,
  options: TrafficOptions,
): Promise<SimBusiness> {
  if (options.businessSlug) {
    const membership = ctx.merchant.membership(options.businessSlug)
    if (!membership?.businessId) {
      throw new Error(`--business=${options.businessSlug} is not owned by the simulator account`)
    }
    return {
      slug: options.businessSlug,
      businessId: membership.businessId,
      vertical: membership.vertical ?? vertical,
      name: membership.businessName ?? options.businessSlug,
    }
  }

  return ensureBusiness(ctx.merchant, vertical)
}

async function runOne(
  ctx: { consumer: ConsumerAgent; merchant: MerchantAgent },
  business: SimBusiness,
  detail: StorefrontDetail,
  rng: Rng,
  options: TrafficOptions,
  stats: Stats,
): Promise<void> {
  const started = performance.now()
  const items = randomCart(detail, rng)
  const delivery = {
    address: 'SIM random drop-off, Cebu City',
    lat: 10.29 + rng.next() * 0.08,
    lng: 123.86 + rng.next() * 0.08,
  }
  const scheduledAt =
    detail.business.vertical === 'aircon'
      ? new Date(Date.now() + rng.int(1, 7) * 24 * 60 * 60 * 1000).toISOString()
      : undefined
  const key = `sim-traffic-${rng.int(1, 1_000_000_000)}-${Date.now()}`

  const placed = await ctx.consumer.place({
    businessId: business.businessId,
    customer: {
      name: `SIM ${rng.pick(['Ana', 'Ben', 'Cara', 'Dino', 'Eya'])}`,
      phone: randomPhone(rng),
      hatodUserId: `sim-traffic-${rng.int(1, 1_000_000)}`,
    },
    items,
    delivery,
    scheduledAt,
    intake:
      detail.business.vertical === 'aircon'
        ? { unitCount: rng.int(1, 3), unitType: 'split' }
        : detail.business.vertical === 'lpg'
          ? { tankSize: '11kg', refillType: rng.pick(['refill', 'exchange']) }
          : undefined,
    idempotencyKey: key,
  })
  stats.placed += 1

  if (rng.chance(0.05)) {
    const replay = await ctx.consumer.place({
      businessId: business.businessId,
      customer: { name: 'SIM Replay', phone: randomPhone(rng) },
      items,
      delivery,
      scheduledAt,
      idempotencyKey: key,
    })
    assert.equal(replay.order.id, placed.order.id, 'idempotent replay must reuse the order')
    stats.idempotentReplays += 1
  }

  if (rng.chance(options.failureRate)) {
    const mode = rng.pick(['reject', 'cancel', 'late-cancel'] as const)
    if (mode === 'reject') {
      await ctx.merchant.transition(business.businessId, placed.order.id, 'REJECTED')
      stats.rejected += 1
    } else if (mode === 'cancel') {
      await ctx.consumer.cancel(placed.order.id, business.businessId)
      stats.cancelled += 1
    } else {
      await ctx.merchant.transition(business.businessId, placed.order.id, 'ACCEPTED')
      if (detail.business.vertical !== 'aircon') {
        await ctx.merchant.transition(business.businessId, placed.order.id, 'PREPARING')
      }
      try {
        await ctx.consumer.cancel(placed.order.id, business.businessId)
        stats.errors += 1
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          stats.lateCancelBlocked += 1
        } else {
          throw error
        }
      }
    }
    stats.latencies.push(performance.now() - started)
    return
  }

  await delay(options.stepDelayMs, rng)
  if (detail.business.vertical === 'aircon') {
    for (const status of ['ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED']) {
      await ctx.merchant.transition(business.businessId, placed.order.id, status)
      if (status !== 'COMPLETED') await delay(options.stepDelayMs, rng)
    }
  } else {
    for (const status of ['ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED']) {
      await ctx.merchant.transition(business.businessId, placed.order.id, status)
      await delay(options.stepDelayMs, rng)
    }
    await ctx.merchant.cashReceived(business.businessId, placed.order.id)
    await ctx.merchant.transition(business.businessId, placed.order.id, 'COMPLETED')
  }
  stats.completed += 1
  stats.latencies.push(performance.now() - started)
}

function randomCart(detail: StorefrontDetail, rng: Rng) {
  const items = detail.categories
    .flatMap((category) => category.items)
    .filter((item) => item.available !== false)
  if (items.length === 0) throw new Error(`No available items for ${detail.business.slug}`)
  const count = Math.min(items.length, rng.int(1, 4))
  const chosen = new Set<string>()
  while (chosen.size < count) {
    chosen.add(rng.pick(items).id)
  }
  return [...chosen].map((itemId) => ({ itemId, quantity: rng.int(1, 3) }))
}

function randomPhone(rng: Rng): string {
  return `+63917${rng.int(0, 9_999_999).toString().padStart(7, '0')}`
}

async function delay(ms: number, rng: Rng): Promise<void> {
  if (ms <= 0) return
  await sleep(Math.round(ms * (0.5 + rng.next())))
}

function summarize(
  stats: Stats,
  launched: number,
  options: TrafficOptions,
): Record<string, number> {
  const sorted = [...stats.latencies].sort((a, b) => a - b)
  return {
    launched,
    placed: stats.placed,
    completed: stats.completed,
    rejected: stats.rejected,
    cancelled: stats.cancelled,
    lateCancelBlocked: stats.lateCancelBlocked,
    idempotentReplays: stats.idempotentReplays,
    errors: stats.errors,
    concurrency: options.concurrency,
    failureRate: options.failureRate,
    p50Ms: Math.round(percentile(sorted, 0.5)),
    p95Ms: Math.round(percentile(sorted, 0.95)),
  }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(p * values.length) - 1))
  return values[index] ?? 0
}
