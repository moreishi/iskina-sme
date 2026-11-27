import { normalizePhone } from '@iskina/core/auth'
import { countRecentChallenges, createOtpChallenge } from '@iskina/db'
import { apiError, apiJson, readJson } from '@/lib/api'
import { OTP_TTL_MINUTES, startOtp } from '@/lib/auth/otp'
import { otpRequestSchema } from '@/lib/auth/validation'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const body = await readJson(request)
  const parsed = otpRequestSchema.safeParse(body)
  if (!parsed.success) return apiError(400, 'invalid_request', 'A phone number is required')

  const phone = normalizePhone(parsed.data.phone)
  if (!phone) {
    return apiError(400, 'invalid_phone', 'Use a Philippine mobile number, e.g. 0917 123 4567')
  }

  const recent = await countRecentChallenges(phone, new Date(Date.now() - 60_000))
  if (recent >= 2) {
    return apiError(429, 'too_many_requests', 'Wait a minute before requesting another code')
  }

  let started: Awaited<ReturnType<typeof startOtp>>
  try {
    started = await startOtp(phone)
  } catch (error) {
    void error
    return apiError(503, 'otp_unavailable', 'Could not send a verification code right now')
  }

  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000)
  const challengeId = await createOtpChallenge({
    phone,
    provider: started.provider,
    providerId: started.providerId,
    codeHash: started.codeHash,
    expiresAt,
  })

  return apiJson({
    challengeId,
    expiresAt: expiresAt.toISOString(),
    channel: started.provider === 'dev' ? 'development' : 'sms',
    devCode: started.devCode,
  })
}
