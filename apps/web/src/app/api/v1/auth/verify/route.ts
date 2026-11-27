import {
  bumpOtpAttempts,
  consumeOtpChallenge,
  findOrCreateUser,
  findOtpChallenge,
  listMembershipsForUser,
  recordAudit,
} from '@iskina/db'
import { apiError, apiJson, clientIp, readJson, userAgent } from '@/lib/api'
import { checkOtp, OTP_MAX_ATTEMPTS } from '@/lib/auth/otp'
import { issueSession, setSessionCookie } from '@/lib/auth/session'
import { otpVerifySchema } from '@/lib/auth/validation'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await readJson(request)
  const parsed = otpVerifySchema.safeParse(body)
  if (!parsed.success) return apiError(400, 'invalid_request', 'Enter the 6-digit code')

  const challenge = await findOtpChallenge(parsed.data.challengeId)
  if (!challenge) return apiError(400, 'invalid_challenge', 'Request a new code')

  if (challenge.consumedAt) {
    return apiError(409, 'already_used', 'This code was already used; request a new one')
  }
  if (challenge.expiresAt.getTime() < Date.now()) {
    return apiError(400, 'expired', 'This code expired; request a new one')
  }
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    return apiError(429, 'too_many_attempts', 'Too many attempts; request a new code')
  }

  let valid: boolean
  try {
    valid = await checkOtp({
      phone: challenge.phone,
      provider: challenge.provider === 'iskina' ? 'iskina' : 'dev',
      providerId: challenge.providerId,
      codeHash: challenge.codeHash,
      code: parsed.data.code,
    })
  } catch {
    return apiError(502, 'otp_unavailable', 'Could not verify the code right now')
  }

  if (!valid) {
    await bumpOtpAttempts(challenge.id)
    return apiError(401, 'invalid_code', 'That code is not correct')
  }

  const consumed = await consumeOtpChallenge(challenge.id)
  if (!consumed) return apiError(409, 'already_used', 'This code was already used')

  const user = await findOrCreateUser(challenge.phone)
  const session = await issueSession({
    userId: user.id,
    ip: clientIp(request),
    userAgent: userAgent(request),
  })
  await setSessionCookie(session.token, session.expiresAt)

  const memberships = await listMembershipsForUser(user.id)
  await recordAudit({
    tenantId: memberships[0]?.tenantId ?? null,
    actorType: 'user',
    actorId: user.id,
    action: 'auth.login',
    entityType: 'user',
    entityId: user.id,
    ip: clientIp(request),
    userAgent: userAgent(request),
  })

  return apiJson({
    user: { id: user.id, phone: user.phone, name: user.name, email: user.email },
    memberships,
    needsOnboarding: memberships.length === 0,
    ...(parsed.data.client === 'mobile' ? { sessionToken: session.token } : {}),
  })
}
