import assert from 'node:assert/strict'
import { randomInt, randomUUID } from 'node:crypto'
import type { SimConfig } from './config'
import type { ConsumerAgent, StorefrontDetail } from './consumer'
import { ApiError, waitForOrderEvent } from './http'
import type { MerchantAgent } from './merchant'
import { ensureBusiness, type SimBusiness, type Vertical } from './seed'

export interface Step {
  name: string
  ok: boolean
  ms: number
  detail?: string
}

export interface ScenarioResult {
  scenario: string
  ok: boolean
  steps: Step[]
  metrics?: Record<string, number>
  error?: string
}

export interface Ctx {
  config: SimConfig
  consumer: ConsumerAgent
  merchant: MerchantAgent
}

const phone = () => `+63917${randomInt(0, 10_000_000).toString().padStart(7, '0')}`
const key = (name: string) => `sim-${name}-${randomUUID()}`

async function step<T>(steps: Step[], name: string, action: () => Promise<T>): Promise<T> {
  const started = performance.now()
  try {
    const value = await action()
    steps.push({ name, ok: true, ms: Math.round(performance.now() - started) })
    return value
  } catch (error) {
    steps.push({
      name,
      ok: false,
      ms: Math.round(performance.now() - started),
      detail: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

function itemsFrom(detail: StorefrontDetail): { itemId: string; quantity: number }[] {
  const items = [...detail.categories.flatMap((category) => category.items)]
    .filter((item) => item.available !== false)
    .slice(0, 2)
  if (items.length === 0) throw new Error(`No available items for ${detail.business.slug}`)
  return items.map((item, index) => ({ itemId: item.id, quantity: index === 0 ? 1 : 1 }))
}

async function place(input: {
  ctx: Ctx
  business: SimBusiness
  detail: StorefrontDetail
  scheduledAt?: string
  intake?: Record<string, unknown>
  idempotencyKey?: string
}) {
  const items = itemsFrom(input.detail)
  const quote = await input.ctx.consumer.quote({
    businessId: input.business.businessId,
    items,
    delivery: { address: 'SIM Lahug, Cebu City', lat: 10.329, lng: 123.906 },
  })
  const placed = await input.ctx.consumer.place({
    businessId: input.business.businessId,
    customer: { name: 'SIM Customer', phone: phone(), hatodUserId: `sim-${randomUUID()}` },
    items,
    delivery: { address: 'SIM Lahug, Cebu City', lat: 10.329, lng: 123.906 },
    scheduledAt: input.scheduledAt,
    intake: input.intake,
    idempotencyKey: input.idempotencyKey ?? key(input.business.slug),
  })
  assert.equal(placed.order.totalCentavos, quote.totalCentavos, 'server total must equal the quote')
  return { placed, quote, items }
}

async function advanceFood(ctx: Ctx, business: SimBusiness, orderId: string, steps: Step[]) {
  for (const status of ['ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED']) {
    await step(steps, `transition ${status}`, () =>
      ctx.merchant.transition(business.businessId, orderId, status),
    )
  }
  await step(steps, 'cash received', () => ctx.merchant.cashReceived(business.businessId, orderId))
  await step(steps, 'transition COMPLETED', () =>
    ctx.merchant.transition(business.businessId, orderId, 'COMPLETED'),
  )
}

async function advanceBooking(ctx: Ctx, business: SimBusiness, orderId: string, steps: Step[]) {
  for (const status of ['ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED']) {
    await step(steps, `transition ${status}`, () =>
      ctx.merchant.transition(business.businessId, orderId, status),
    )
  }
}

async function assertStatus(ctx: Ctx, business: SimBusiness, orderId: string, expected: string) {
  const status = await ctx.consumer.status(orderId, business.businessId)
  assert.equal(status.order.status, expected)
  return status
}

export async function foodScenario(ctx: Ctx): Promise<ScenarioResult> {
  const steps: Step[] = []
  try {
    const business = await step(steps, 'ensure SIM food business', () =>
      ensureBusiness(ctx.merchant, 'food'),
    )
    const detail = await step(steps, 'storefront', () => ctx.consumer.storefront(business.slug))
    assert.ok(detail.categories.some((category) => category.items.length > 0))

    const token = ctx.merchant.http.getToken()
    if (!token) throw new Error('Merchant session token missing')
    const sse = waitForOrderEvent({
      baseUrl: ctx.config.baseUrl,
      token,
      businessId: business.businessId,
      timeoutMs: 20_000,
    })
      .then(() => null)
      .catch((error: unknown) => error)
    const { placed } = await step(steps, 'place order', () => place({ ctx, business, detail }))
    await step(steps, 'SSE orders event', async () => {
      const failure = await sse
      if (failure) throw failure
    })
    await step(steps, 'status PLACED', () => assertStatus(ctx, business, placed.order.id, 'PLACED'))

    const board = await step(steps, 'merchant board', () =>
      ctx.merchant.orders(business.businessId),
    )
    assert.ok(board.some((row) => row.order.id === placed.order.id))

    await advanceFood(ctx, business, placed.order.id, steps)
    const final = await step(steps, 'status COMPLETED', () =>
      assertStatus(ctx, business, placed.order.id, 'COMPLETED'),
    )
    assert.ok(final.events.some((event) => event.toStatus === 'COMPLETED'))

    const totals = await step(steps, 'analytics', () => ctx.merchant.analytics(business.businessId))
    assert.ok(totals.ordersPlaced >= 1)

    return { scenario: 'food', ok: true, steps }
  } catch (error) {
    return { scenario: 'food', ok: false, steps, error: message(error) }
  }
}

export async function airconScenario(ctx: Ctx): Promise<ScenarioResult> {
  const steps: Step[] = []
  try {
    const business = await step(steps, 'ensure SIM aircon business', () =>
      ensureBusiness(ctx.merchant, 'aircon'),
    )
    const detail = await step(steps, 'storefront', () => ctx.consumer.storefront(business.slug))
    assert.equal(detail.config.fulfillment, 'booking')
    assert.equal(detail.config.requiresSchedule, true)

    const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const { placed, quote } = await step(steps, 'place booking', () =>
      place({
        ctx,
        business,
        detail,
        scheduledAt,
        intake: { unitCount: 2, unitType: 'split' },
      }),
    )
    assert.equal(quote.deliveryFeeCentavos, 0, 'bookings have no delivery fee')

    await advanceBooking(ctx, business, placed.order.id, steps)
    await step(steps, 'status COMPLETED', () =>
      assertStatus(ctx, business, placed.order.id, 'COMPLETED'),
    )

    return { scenario: 'aircon', ok: true, steps }
  } catch (error) {
    return { scenario: 'aircon', ok: false, steps, error: message(error) }
  }
}

export async function lpgScenario(ctx: Ctx): Promise<ScenarioResult> {
  const steps: Step[] = []
  try {
    const business = await step(steps, 'ensure SIM lpg business', () =>
      ensureBusiness(ctx.merchant, 'lpg'),
    )
    const detail = await step(steps, 'storefront', () => ctx.consumer.storefront(business.slug))
    const { placed } = await step(steps, 'place refill order', () =>
      place({
        ctx,
        business,
        detail,
        intake: { tankSize: '11kg', refillType: 'exchange' },
      }),
    )
    await advanceFood(ctx, business, placed.order.id, steps)
    await step(steps, 'status COMPLETED', () =>
      assertStatus(ctx, business, placed.order.id, 'COMPLETED'),
    )

    return { scenario: 'lpg', ok: true, steps }
  } catch (error) {
    return { scenario: 'lpg', ok: false, steps, error: message(error) }
  }
}

export async function failuresScenario(ctx: Ctx): Promise<ScenarioResult> {
  const steps: Step[] = []
  try {
    const business = await step(steps, 'ensure SIM food business', () =>
      ensureBusiness(ctx.merchant, 'food'),
    )
    const detail = await step(steps, 'storefront', () => ctx.consumer.storefront(business.slug))

    // Customer cancellation, then a second cancel must be refused.
    const cancelA = await step(steps, 'place then cancel', () => place({ ctx, business, detail }))
    await step(steps, 'cancel CANCELLED', async () => {
      const result = await ctx.consumer.cancel(cancelA.placed.order.id, business.businessId)
      assert.equal(result.order.status, 'CANCELLED')
    })
    await step(steps, 'second cancel -> 409', async () => {
      await expectApiError(
        () => ctx.consumer.cancel(cancelA.placed.order.id, business.businessId),
        409,
      )
    })

    // Late cancellation after PREPARING must be refused.
    const late = await step(steps, 'place late-cancel order', () =>
      place({ ctx, business, detail }),
    )
    await step(steps, 'accept + prepare', async () => {
      await ctx.merchant.transition(business.businessId, late.placed.order.id, 'ACCEPTED')
      await ctx.merchant.transition(business.businessId, late.placed.order.id, 'PREPARING')
    })
    await step(steps, 'late cancel -> 409', async () => {
      await expectApiError(
        () => ctx.consumer.cancel(late.placed.order.id, business.businessId),
        409,
      )
    })

    // Invalid transition: PLACED -> READY.
    const invalid = await step(steps, 'place invalid-transition order', () =>
      place({ ctx, business, detail }),
    )
    await step(steps, 'PLACED -> READY -> 409', async () => {
      await expectApiError(
        () => ctx.merchant.transition(business.businessId, invalid.placed.order.id, 'READY'),
        409,
      )
    })

    // Idempotent placement returns the same order.
    const idempotencyKey = key('idempotent')
    await step(steps, 'idempotent replay', async () => {
      const first = await place({ ctx, business, detail, idempotencyKey })
      const second = await place({ ctx, business, detail, idempotencyKey })
      assert.equal(second.placed.order.id, first.placed.order.id)
    })

    // Merchant rejection.
    const rejected = await step(steps, 'place rejectable order', () =>
      place({ ctx, business, detail }),
    )
    await step(steps, 'reject', async () => {
      await ctx.merchant.transition(business.businessId, rejected.placed.order.id, 'REJECTED')
      await assertStatus(ctx, business, rejected.placed.order.id, 'REJECTED')
    })

    return { scenario: 'failures', ok: true, steps }
  } catch (error) {
    return { scenario: 'failures', ok: false, steps, error: message(error) }
  }
}

export async function mixedScenario(
  ctx: Ctx,
  options: { orders: number; concurrency: number },
): Promise<ScenarioResult> {
  const steps: Step[] = []
  const metrics: Record<string, number> = { orders: options.orders, errors: 0 }
  try {
    const businesses = {
      food: await ensureBusiness(ctx.merchant, 'food'),
      aircon: await ensureBusiness(ctx.merchant, 'aircon'),
      lpg: await ensureBusiness(ctx.merchant, 'lpg'),
    }
    const verticals: Vertical[] = ['food', 'aircon', 'lpg']
    const latencies: number[] = []
    let errors = 0

    await pool(
      Array.from({ length: options.orders }, (_, index) => index),
      options.concurrency,
      async (index) => {
        const vertical = verticals[index % verticals.length] ?? 'food'
        const started = performance.now()
        await runOne(ctx, businesses[vertical], vertical)
        latencies.push(performance.now() - started)
      },
      () => {
        errors += 1
      },
    )

    metrics.errors = errors
    const total = latencies.reduce((a, b) => a + b, 0)
    metrics.throughput = round(1000 / (total / Math.max(1, latencies.length)))
    steps.push({
      name: `${options.orders} mixed orders`,
      ok: errors === 0,
      ms: Math.round(total),
    })
    return { scenario: 'mixed', ok: errors === 0, steps, metrics }
  } catch (error) {
    return { scenario: 'mixed', ok: false, steps, metrics, error: message(error) }
  }
}

export async function loadScenario(
  ctx: Ctx,
  options: { orders: number; concurrency: number },
): Promise<ScenarioResult> {
  const steps: Step[] = []
  const verticals: Vertical[] = ['food', 'aircon', 'lpg']
  const started = performance.now()
  let errors = 0
  const latencies: number[] = []

  try {
    const businesses = {
      food: await ensureBusiness(ctx.merchant, 'food'),
      aircon: await ensureBusiness(ctx.merchant, 'aircon'),
      lpg: await ensureBusiness(ctx.merchant, 'lpg'),
    }

    await pool(
      Array.from({ length: options.orders }, (_, index) => index),
      options.concurrency,
      async (index) => {
        const vertical = verticals[index % verticals.length] ?? 'food'
        const begin = performance.now()
        await runOne(ctx, businesses[vertical], vertical)
        latencies.push(performance.now() - begin)
      },
      () => {
        errors += 1
      },
    )

    const elapsed = performance.now() - started
    latencies.sort((a, b) => a - b)
    const metrics = {
      orders: options.orders,
      errors,
      p50Ms: Math.round(percentile(latencies, 0.5)),
      p95Ms: Math.round(percentile(latencies, 0.95)),
      throughputPerSec: round(options.orders / (elapsed / 1000)),
      elapsedMs: Math.round(elapsed),
    }
    steps.push({
      name: `${options.orders} orders @ ${options.concurrency}`,
      ok: errors === 0,
      ms: Math.round(elapsed),
    })
    return { scenario: 'load', ok: errors === 0, steps, metrics }
  } catch (error) {
    return { scenario: 'load', ok: false, steps, error: message(error) }
  }
}

async function runOne(ctx: Ctx, business: SimBusiness, vertical: Vertical): Promise<void> {
  const detail = await ctx.consumer.storefront(business.slug)
  if (vertical === 'aircon') {
    const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const { placed } = await place({
      ctx,
      business,
      detail,
      scheduledAt,
      intake: { unitCount: 1, unitType: 'split' },
    })
    for (const status of ['ACCEPTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED']) {
      await ctx.merchant.transition(business.businessId, placed.order.id, status)
    }
    return
  }

  const { placed } = await place({
    ctx,
    business,
    detail,
    intake: vertical === 'lpg' ? { tankSize: '11kg', refillType: 'exchange' } : undefined,
  })
  for (const status of ['ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED']) {
    await ctx.merchant.transition(business.businessId, placed.order.id, status)
  }
  await ctx.merchant.cashReceived(business.businessId, placed.order.id)
  await ctx.merchant.transition(business.businessId, placed.order.id, 'COMPLETED')
}

async function expectApiError(action: () => Promise<unknown>, status: number): Promise<void> {
  try {
    await action()
  } catch (error) {
    if (error instanceof ApiError && error.status === status) return
    throw error
  }
  throw new Error(`Expected HTTP ${status}`)
}

async function pool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
  onError: (error: unknown) => void,
): Promise<void> {
  let cursor = 0
  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (cursor < items.length) {
      const index = cursor++
      try {
        await worker(items[index] as T)
      } catch (error) {
        onError(error)
      }
    }
  })
  await Promise.all(runners)
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const index = Math.min(values.length - 1, Math.max(0, Math.ceil(p * values.length) - 1))
  return values[index] ?? 0
}

const round = (value: number) => Math.round(value * 100) / 100
const message = (error: unknown) => (error instanceof Error ? error.message : String(error))
