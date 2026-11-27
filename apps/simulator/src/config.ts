import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config as loadEnv } from 'dotenv'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../../..')

loadEnv({ path: resolve(root, '.env'), quiet: true })
loadEnv({ path: resolve(root, '.env.local'), override: true, quiet: true })

export interface SimConfig {
  baseUrl: string
  platformKey: string
  merchantPhone: string
  allowRemote: boolean
  allowProduction: boolean
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '10.0.2.2', '::1'])
const PRODUCTION_HOSTS = new Set(['sme.iskina.cc', 'iskina.cc'])

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

export function assertSafeTarget(
  baseUrl: string,
  env: Record<string, string | undefined> = process.env,
): URL {
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    throw new ConfigError(`Invalid BASE_URL: ${baseUrl}`)
  }

  const local = LOCAL_HOSTS.has(url.hostname)
  if (!local && env.SIM_ALLOW_REMOTE !== '1') {
    throw new ConfigError(
      `Refusing remote target ${url.hostname}. Set SIM_ALLOW_REMOTE=1 for staging.`,
    )
  }
  if (PRODUCTION_HOSTS.has(url.hostname) && env.SIM_ALLOW_PRODUCTION !== '1') {
    throw new ConfigError(
      `Refusing production target ${url.hostname}. Set SIM_ALLOW_PRODUCTION=1 only with explicit approval.`,
    )
  }
  return url
}

export function loadConfig(overrides: Partial<SimConfig> = {}): SimConfig {
  const baseUrl = (
    overrides.baseUrl ??
    process.env.SIM_BASE_URL ??
    'http://localhost:3008'
  ).replace(/\/$/, '')
  assertSafeTarget(baseUrl)

  const platformKey = overrides.platformKey ?? process.env.CHANNEL_PLATFORM_KEY?.trim() ?? ''
  if (!platformKey) {
    throw new ConfigError('CHANNEL_PLATFORM_KEY is required (see .env.example).')
  }

  return {
    baseUrl,
    platformKey,
    merchantPhone: overrides.merchantPhone ?? process.env.SIM_MERCHANT_PHONE ?? '+639170000001',
    allowRemote: process.env.SIM_ALLOW_REMOTE === '1',
    allowProduction: process.env.SIM_ALLOW_PRODUCTION === '1',
  }
}
