import { describe, expect, it } from 'vitest'
import { addDays, dayRange, localDay, percentChange } from '../src/analytics/time'

describe('business-timezone days', () => {
  it('uses the Manila date, not UTC', () => {
    // 2026-11-30T16:30Z is already 1 December in Manila.
    const instant = new Date('2026-11-30T16:30:00.000Z')
    expect(localDay(instant, 'Asia/Manila')).toBe('2026-12-01')
    expect(localDay(instant, 'UTC')).toBe('2026-11-30')
  })

  it('falls back to UTC for an invalid timezone', () => {
    const instant = new Date('2026-11-30T16:30:00.000Z')
    expect(localDay(instant, 'Not/AZone')).toBe('2026-11-30')
  })

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('builds a window that includes today', () => {
    const range = dayRange(7, new Date('2026-11-27T04:00:00.000Z'), 'Asia/Manila')
    expect(range.to).toBe('2026-11-27')
    expect(range.from).toBe('2026-11-21')
    expect(range.previousTo).toBe('2026-11-20')
    expect(range.previousFrom).toBe('2026-11-14')
  })

  it('clamps absurd windows', () => {
    expect(dayRange(0, new Date(), 'Asia/Manila').days).toBe(1)
    expect(dayRange(99_999, new Date(), 'Asia/Manila').days).toBe(365)
  })
})

describe('percentChange', () => {
  it('computes change and handles a zero base', () => {
    expect(percentChange(120, 100)).toBe(20)
    expect(percentChange(80, 100)).toBe(-20)
    expect(percentChange(0, 0)).toBe(0)
    expect(percentChange(10, 0)).toBeNull()
  })
})
