import { describe, expect, it } from 'vitest'
import { createRng, parseDuration } from '../src/random'

describe('seeded rng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(42)
    const b = createRng(42)
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()])
  })

  it('differs across seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next())
  })

  it('keeps ints inside the range and picks real members', () => {
    const rng = createRng(7)
    for (let i = 0; i < 50; i += 1) {
      const value = rng.int(3, 9)
      expect(value).toBeGreaterThanOrEqual(3)
      expect(value).toBeLessThanOrEqual(9)
      expect(['a', 'b', 'c']).toContain(rng.pick(['a', 'b', 'c']))
    }
  })

  it('chance(0) never fires and chance(1) always does', () => {
    const rng = createRng(9)
    expect(rng.chance(0)).toBe(false)
    expect(rng.chance(1)).toBe(true)
  })
})

describe('parseDuration', () => {
  it('parses seconds, minutes and hours', () => {
    expect(parseDuration('30s')).toBe(30_000)
    expect(parseDuration('5m')).toBe(300_000)
    expect(parseDuration('1.5m')).toBe(90_000)
    expect(parseDuration('2h')).toBe(7_200_000)
  })

  it('returns null when absent and throws on junk', () => {
    expect(parseDuration(undefined)).toBeNull()
    expect(() => parseDuration('10 minutes')).toThrow(/Invalid duration/)
  })
})
