import { healthResponseSchema } from '@iskina/contracts'
import { describe, expect, it } from 'vitest'
import { buildHealthResponse } from '../src/lib/health'

describe('health response', () => {
  it('reports ok when the database answers', () => {
    const body = buildHealthResponse({
      database: 'ok',
      now: new Date('2026-11-27T00:00:00.000Z'),
      uptimeSeconds: 12,
    })
    expect(body.status).toBe('ok')
    expect(body.service).toBe('iskina-sme')
    expect(body.checkedAt).toBe('2026-11-27T00:00:00.000Z')
    expect(healthResponseSchema.safeParse(body).success).toBe(true)
  })

  it('degrades instead of throwing when the database is down', () => {
    const body = buildHealthResponse({ database: 'error', uptimeSeconds: 0 })
    expect(body.status).toBe('degraded')
    expect(body.database).toBe('error')
    expect(healthResponseSchema.safeParse(body).success).toBe(true)
  })

  it('never reports negative uptime', () => {
    expect(buildHealthResponse({ database: 'ok', uptimeSeconds: -5 }).uptimeSeconds).toBe(0)
  })
})
