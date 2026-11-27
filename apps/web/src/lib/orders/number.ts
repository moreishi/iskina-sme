import { randomBytes } from 'node:crypto'

/** Human-readable, unique by construction; the DB unique index is the guard. */
export function makeOrderNumber(now = new Date()): string {
  const day = now.toISOString().slice(0, 10).replace(/-/g, '')
  return `SME-${day}-${randomBytes(2).toString('hex').toUpperCase()}`
}
