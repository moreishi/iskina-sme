import type { HealthResponse } from '@iskina/contracts'

export const SERVICE_VERSION = '0.1.0'

export interface HealthInput {
  database: 'ok' | 'error'
  now?: Date
  uptimeSeconds?: number
}

/**
 * Pure so the route stays a thin adapter and the contract can be tested
 * without a live database.
 */
export function buildHealthResponse(input: HealthInput): HealthResponse {
  const database = input.database
  return {
    service: 'iskina-sme',
    version: SERVICE_VERSION,
    status: database === 'ok' ? 'ok' : 'degraded',
    database,
    uptimeSeconds: Math.max(0, input.uptimeSeconds ?? Math.round(process.uptime())),
    checkedAt: (input.now ?? new Date()).toISOString(),
  }
}
