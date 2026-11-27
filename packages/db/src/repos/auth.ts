import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import { getDb } from '../client'
import { sessions, users } from '../schema'

export interface CreatedSession {
  id: string
  tokenHash: string
  expiresAt: Date
}

export async function findOrCreateUser(phone: string) {
  const db = getDb()
  const inserted = await db
    .insert(users)
    .values({ phone })
    .onConflictDoNothing({ target: users.phone })
    .returning()

  if (inserted[0]) return inserted[0]

  const existing = await db.select().from(users).where(eq(users.phone, phone)).limit(1)
  const user = existing[0]
  if (!user) throw new Error('user upsert returned no row')
  return user
}

export async function createSession(input: {
  userId: string
  tokenHash: string
  expiresAt: Date
  ip?: string | null
  userAgent?: string | null
}): Promise<CreatedSession> {
  const db = getDb()
  const rows = await db
    .insert(sessions)
    .values({
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    })
    .returning({
      id: sessions.id,
      tokenHash: sessions.tokenHash,
      expiresAt: sessions.expiresAt,
    })
  const session = rows[0]
  if (!session) throw new Error('session insert returned no row')
  return session
}

export async function findSessionByTokenHash(tokenHash: string) {
  const db = getDb()
  const rows = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

export async function revokeSessionByHash(tokenHash: string, userId: string): Promise<boolean> {
  const db = getDb()
  const rows = await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.tokenHash, tokenHash), eq(sessions.userId, userId)))
    .returning({ id: sessions.id })
  return rows.length > 0
}

export async function deleteExpiredSessions(olderThan: Date): Promise<number> {
  const db = getDb()
  const rows = await db
    .delete(sessions)
    .where(sql`${sessions.expiresAt} < ${olderThan}`)
    .returning({ id: sessions.id })
  return rows.length
}

export async function latestSessionForUser(userId: string) {
  const db = getDb()
  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.createdAt))
    .limit(1)
  return rows[0] ?? null
}
