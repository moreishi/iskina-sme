import { randomToken, sha256Hex } from '@iskina/core/auth'
import {
  createSession,
  findSessionByTokenHash,
  listMembershipsForUser,
  type MembershipView,
  revokeSessionByHash,
  type User,
} from '@iskina/db'
import { cookies } from 'next/headers'

export const SESSION_COOKIE = 'iskina_sme_session'
const DEFAULT_TTL_DAYS = 30

export interface SessionContext {
  user: Pick<User, 'id' | 'phone' | 'name' | 'email'>
  memberships: MembershipView[]
}

function ttlDays(): number {
  const parsed = Number(process.env.SESSION_TTL_DAYS)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_DAYS
}

export async function issueSession(input: {
  userId: string
  ip?: string | null
  userAgent?: string | null
}): Promise<{ token: string; expiresAt: Date }> {
  const token = randomToken(32)
  const expiresAt = new Date(Date.now() + ttlDays() * 24 * 60 * 60 * 1000)
  await createSession({
    userId: input.userId,
    tokenHash: sha256Hex(token),
    expiresAt,
    ip: input.ip,
    userAgent: input.userAgent,
  })
  return { token, expiresAt }
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
}

async function sessionToken(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(SESSION_COOKIE)?.value ?? null
}

export async function currentSession(): Promise<SessionContext | null> {
  const token = await sessionToken()
  if (!token) return null

  const found = await findSessionByTokenHash(sha256Hex(token))
  if (!found) return null

  const memberships = await listMembershipsForUser(found.user.id)
  return {
    user: {
      id: found.user.id,
      phone: found.user.phone,
      name: found.user.name,
      email: found.user.email,
    },
    memberships,
  }
}

export async function endSession(): Promise<void> {
  const token = await sessionToken()
  if (token) {
    const found = await findSessionByTokenHash(sha256Hex(token))
    if (found) await revokeSessionByHash(sha256Hex(token), found.user.id)
  }
  await clearSessionCookie()
}

export type OwnerMembership = MembershipView & { role: 'owner' }

/** Owner-only tenant actions resolve the membership from the session, not a client claim. */
export function ownerMembership(
  session: SessionContext,
  tenantId?: string | null,
): OwnerMembership | null {
  const owners = session.memberships.filter(
    (membership): membership is OwnerMembership => membership.role === 'owner',
  )
  if (tenantId) return owners.find((membership) => membership.tenantId === tenantId) ?? null
  return owners[0] ?? null
}
