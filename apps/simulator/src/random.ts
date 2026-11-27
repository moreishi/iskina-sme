export interface Rng {
  next(): number
  int(min: number, max: number): number
  pick<T>(values: readonly T[]): T
  chance(probability: number): boolean
}

/** Mulberry32; a seed makes a traffic run reproducible. */
export function createRng(seed = Date.now()): Rng {
  let state = seed >>> 0

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(values: readonly T[]): T => {
      if (values.length === 0) throw new Error('Cannot pick from an empty list')
      return values[Math.floor(next() * values.length)] as T
    },
    chance: (probability) => next() < probability,
  }
}

export function parseDuration(value: string | undefined): number | null {
  if (!value) return null
  const match = /^(\d+(?:\.\d+)?)(s|m|h)$/.exec(value.trim())
  if (!match) throw new Error(`Invalid duration "${value}". Use 30s, 5m or 1h.`)
  const amount = Number(match[1])
  const unit = match[2]
  const multiplier = unit === 's' ? 1_000 : unit === 'm' ? 60_000 : 3_600_000
  return Math.round(amount * multiplier)
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
