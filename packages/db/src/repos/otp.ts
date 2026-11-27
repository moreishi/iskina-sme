import { and, eq, gte, isNull, lt, sql } from 'drizzle-orm'
import { getDb } from '../client'
import { otpChallenges } from '../schema'

export interface CreateChallengeInput {
  phone: string
  provider: string
  providerId: string | null
  codeHash: string | null
  expiresAt: Date
}

export async function createOtpChallenge(input: CreateChallengeInput): Promise<string> {
  const db = getDb()
  const rows = await db.insert(otpChallenges).values(input).returning({ id: otpChallenges.id })
  const row = rows[0]
  if (!row) throw new Error('otp challenge insert returned no row')
  return row.id
}

export async function findOtpChallenge(id: string) {
  const db = getDb()
  const rows = await db.select().from(otpChallenges).where(eq(otpChallenges.id, id)).limit(1)
  return rows[0] ?? null
}

export async function bumpOtpAttempts(id: string): Promise<number> {
  const db = getDb()
  const rows = await db
    .update(otpChallenges)
    .set({ attempts: sql`${otpChallenges.attempts} + 1` })
    .where(eq(otpChallenges.id, id))
    .returning({ attempts: otpChallenges.attempts })
  return rows[0]?.attempts ?? 0
}

export async function consumeOtpChallenge(id: string): Promise<boolean> {
  const db = getDb()
  const rows = await db
    .update(otpChallenges)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpChallenges.id, id), isNull(otpChallenges.consumedAt)))
    .returning({ id: otpChallenges.id })
  return rows.length > 0
}

export async function deleteExpiredChallenges(olderThan: Date): Promise<number> {
  const db = getDb()
  const rows = await db
    .delete(otpChallenges)
    .where(lt(otpChallenges.expiresAt, olderThan))
    .returning({ id: otpChallenges.id })
  return rows.length
}

/** Cheap per-phone throttle: two requests inside the window is the limit. */
export async function countRecentChallenges(phone: string, since: Date): Promise<number> {
  const db = getDb()
  const rows = await db
    .select({ id: otpChallenges.id })
    .from(otpChallenges)
    .where(and(eq(otpChallenges.phone, phone), gte(otpChallenges.createdAt, since)))
    .limit(3)
  return rows.length
}
