import { generateOtpCode, hashOtpCode, safeEqualHex } from '@iskina/core/auth'

export const OTP_TTL_MINUTES = 10
export const OTP_MAX_ATTEMPTS = 5

type OtpMode = 'iskina' | 'dev' | 'disabled'

function mode(): OtpMode {
  if (process.env.ISKINA_OTP_API_KEY?.trim()) return 'iskina'
  if (process.env.AUTH_ALLOW_DEV_OTP === 'true') return 'dev'
  return process.env.NODE_ENV === 'production' ? 'disabled' : 'dev'
}

function iskinaBaseUrl(): string {
  return (process.env.ISKINA_OTP_BASE_URL?.trim() || 'https://dev-otp.iskina.ph').replace(/\/$/, '')
}

function exposeDevCode(): boolean {
  if (process.env.AUTH_EXPOSE_DEV_OTP === 'true') return true
  if (process.env.AUTH_EXPOSE_DEV_OTP === 'false') return false
  return process.env.NODE_ENV !== 'production'
}

export interface StartedOtp {
  provider: 'iskina' | 'dev'
  providerId: string | null
  codeHash: string | null
  devCode: string | null
}

export async function startOtp(phone: string): Promise<StartedOtp> {
  const current = mode()
  if (current === 'disabled') {
    throw new Error('OTP provider is not configured')
  }

  if (current === 'iskina') {
    const response = await fetch(`${iskinaBaseUrl()}/api/v1/verifications`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.ISKINA_OTP_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        to: phone,
        channel: process.env.ISKINA_OTP_PHONE_CHANNEL?.trim() || 'sms',
      }),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`Iskina OTP refused the request (${response.status})`)
    }

    const payload = (await response.json()) as {
      id?: string
      verification?: { id?: string }
    }
    const providerId = payload.id ?? payload.verification?.id
    if (!providerId) throw new Error('Iskina OTP returned no verification id')

    return { provider: 'iskina', providerId, codeHash: null, devCode: null }
  }

  const code = generateOtpCode()
  return {
    provider: 'dev',
    providerId: null,
    codeHash: hashOtpCode(phone, code),
    devCode: exposeDevCode() ? code : null,
  }
}

export async function checkOtp(input: {
  phone: string
  provider: 'iskina' | 'dev'
  providerId: string | null
  codeHash: string | null
  code: string
}): Promise<boolean> {
  if (input.provider === 'iskina') {
    if (!input.providerId) return false
    const response = await fetch(
      `${iskinaBaseUrl()}/api/v1/verifications/${encodeURIComponent(input.providerId)}/check`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${process.env.ISKINA_OTP_API_KEY}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ code: input.code }),
        signal: AbortSignal.timeout(10_000),
        cache: 'no-store',
      },
    )
    if (response.status === 400 || response.status === 401 || response.status === 404) {
      return false
    }
    if (!response.ok) {
      throw new Error(`Iskina OTP check failed (${response.status})`)
    }
    return true
  }

  if (!input.codeHash) return false
  return safeEqualHex(hashOtpCode(input.phone, input.code), input.codeHash)
}
