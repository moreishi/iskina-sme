import { ConfigError, loadConfig, type SimConfig } from './config'
import { ConsumerAgent } from './consumer'
import { HttpClient } from './http'
import { MerchantAgent } from './merchant'
import { parseDuration } from './random'
import { printResult, readJournal, writeJournal } from './report'
import {
  airconScenario,
  type Ctx,
  failuresScenario,
  foodScenario,
  loadScenario,
  lpgScenario,
  mixedScenario,
  type ScenarioResult,
} from './scenarios'
import { seedAll, type Vertical } from './seed'
import { trafficScenario } from './traffic'

const HELP = `
Iskina SME simulator

  pnpm sim:seed
  pnpm sim:food
  pnpm sim:aircon
  pnpm sim:lpg
  pnpm sim:failures
  pnpm sim:mixed --orders=20 --concurrency=5
  pnpm sim:load  --orders=100 --concurrency=10
  pnpm sim:traffic --duration=10m --rate=2 --failure-rate=0.1
  pnpm sim:replay sim-reports/food-....json

Flags:
  --base-url=http://localhost:3008   override SIM_BASE_URL
  --orders=N --concurrency=N         mixed/load/traffic
  --duration=10m --rate=2            traffic window and orders per second
  --vertical=food|aircon|lpg|mixed   traffic mix (default mixed)
  --failure-rate=0.1 --seed=42       traffic failure share and RNG seed
  --business=<slug>                  traffic target (default SIM stores)
  --step-delay=500                   traffic ms between merchant steps
  --verbose                          print every step

Safety:
  remote hosts need SIM_ALLOW_REMOTE=1
  production hosts need SIM_ALLOW_REMOTE=1 and SIM_ALLOW_PRODUCTION=1
`.trim()

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const command = argv[0] ?? 'help'
  const flags = new Map<string, string>()
  const positional: string[] = []
  for (const arg of argv.slice(1)) {
    if (arg.startsWith('--')) {
      const [rawName, rawValue] = arg.slice(2).split('=', 2)
      if (!rawName) continue
      flags.set(rawName, rawValue ?? 'true')
    } else {
      positional.push(arg)
    }
  }

  if (command === 'help' || command === '--help') {
    console.log(HELP)
    return
  }

  const config = loadConfig({
    baseUrl: flags.get('base-url'),
  } as Partial<SimConfig>)
  const merchant = await MerchantAgent.login(config.baseUrl, config.merchantPhone)
  const consumer = new ConsumerAgent(new HttpClient(config.baseUrl, config.platformKey))
  const ctx: Ctx = { config, consumer, merchant }

  if (command === 'seed') {
    const businesses = await seedAll(merchant)
    console.log(`Seeded ${businesses.length} SIM businesses on ${config.baseUrl}:`)
    for (const business of businesses) {
      console.log(
        `  ${business.slug.padEnd(12)} ${business.vertical.padEnd(7)} ${business.businessId}`,
      )
    }
    return
  }

  const orders = numberFlag(flags.get('orders'), command === 'load' ? 100 : 20)
  const concurrency = numberFlag(flags.get('concurrency'), command === 'load' ? 10 : 5)
  const options = { orders, concurrency }

  let result: ScenarioResult
  switch (command) {
    case 'food':
      result = await foodScenario(ctx)
      break
    case 'aircon':
      result = await airconScenario(ctx)
      break
    case 'lpg':
      result = await lpgScenario(ctx)
      break
    case 'failures':
      result = await failuresScenario(ctx)
      break
    case 'mixed':
      result = await mixedScenario(ctx, options)
      break
    case 'load':
      result = await loadScenario(ctx, options)
      break
    case 'traffic': {
      const verticalFlag = flags.get('vertical') ?? 'mixed'
      if (!['food', 'aircon', 'lpg', 'mixed'].includes(verticalFlag)) {
        throw new Error(`Unknown vertical: ${verticalFlag}`)
      }
      const durationMs = parseDuration(flags.get('duration'))
      result = await trafficScenario(ctx, {
        orders: flags.has('orders') ? numberFlag(flags.get('orders'), 50) : undefined,
        durationMs: durationMs ?? undefined,
        concurrency: numberFlag(flags.get('concurrency'), 5),
        failureRate: clamp(Number(flags.get('failure-rate') ?? 0), 0, 1),
        ratePerSec: Math.max(0.05, Number(flags.get('rate') ?? 1)),
        vertical: verticalFlag as Vertical | 'mixed',
        seed: flags.has('seed') ? Number(flags.get('seed')) : undefined,
        businessSlug: flags.get('business'),
        stepDelayMs: Math.max(0, Number(flags.get('step-delay') ?? 500)),
      })
      break
    }
    case 'replay': {
      const file = positional[0]
      if (!file) throw new Error('replay needs a journal path')
      const journal = await readJournal(file)
      result = await runByName(journal.scenario, ctx, {
        orders: journal.options.orders ?? 20,
        concurrency: journal.options.concurrency ?? 5,
      })
      break
    }
    default:
      console.log(`Unknown command: ${command}\n\n${HELP}`)
      process.exitCode = 1
      return
  }

  printResult(result, flags.get('verbose') === 'true')
  const file = await writeJournal(result, command === 'replay' ? {} : options)
  console.log(`  journal: ${file}`)
  if (!result.ok) process.exitCode = 1
}

async function runByName(
  scenario: string,
  ctx: Ctx,
  options: { orders: number; concurrency: number },
): Promise<ScenarioResult> {
  switch (scenario) {
    case 'food':
      return foodScenario(ctx)
    case 'aircon':
      return airconScenario(ctx)
    case 'lpg':
      return lpgScenario(ctx)
    case 'failures':
      return failuresScenario(ctx)
    case 'mixed':
      return mixedScenario(ctx, options)
    case 'load':
      return loadScenario(ctx, options)
    case 'traffic':
      return trafficScenario(ctx, {
        orders: options.orders,
        concurrency: options.concurrency,
        failureRate: 0,
        vertical: 'mixed',
        stepDelayMs: 0,
      })
    default:
      throw new Error(`Unknown scenario in journal: ${scenario}`)
  }
}

function numberFlag(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

main().catch((error) => {
  if (error instanceof ConfigError) {
    console.error(`config: ${error.message}`)
  } else {
    console.error(error instanceof Error ? error.message : error)
  }
  process.exitCode = 1
})
