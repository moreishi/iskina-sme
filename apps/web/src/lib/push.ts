import { listActiveDevices } from '@iskina/db'

export interface PushMessage {
  title: string
  body: string
  data?: Record<string, string>
}

export interface PushResult {
  sent: number
  skipped: number
}

/**
 * FCM legacy HTTP is used when FCM_SERVER_KEY is set; otherwise the message is
 * logged and skipped. The merchant app targets FCM, so this is the only seam
 * that changes when credentials land.
 */
export async function notifyBusiness(
  scope: { tenantId: string; businessId: string },
  message: PushMessage,
): Promise<PushResult> {
  const devices = await listActiveDevices(scope.tenantId, scope.businessId)
  if (devices.length === 0) return { sent: 0, skipped: 0 }

  const key = process.env.FCM_SERVER_KEY?.trim()
  if (!key) {
    console.info(`[push] ${devices.length} device(s) skipped: FCM is not configured`)
    return { sent: 0, skipped: devices.length }
  }

  let sent = 0
  for (const device of devices) {
    try {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          authorization: `key=${key}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          to: device.token,
          priority: 'high',
          notification: { title: message.title, body: message.body },
          data: message.data ?? {},
          android: { priority: 'high' },
        }),
        signal: AbortSignal.timeout(5_000),
      })
      if (response.ok) sent += 1
    } catch {
      // A dead token must never block order processing.
    }
  }

  return { sent, skipped: devices.length - sent }
}
