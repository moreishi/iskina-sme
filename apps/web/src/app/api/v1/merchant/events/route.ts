import { listOrders } from '@iskina/db'
import { apiError } from '@/lib/api'
import { businessMembership } from '@/lib/auth/business'
import { currentSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

const TICK_MS = 4_000
const MAX_LIFETIME_MS = 5 * 60_000

/** Cookie-authenticated SSE. The client re-fetches orders when `orders` fires. */
export async function GET(request: Request) {
  const session = await currentSession()
  if (!session) return apiError(401, 'unauthorized', 'Sign in to continue')

  const businessId = new URL(request.url).searchParams.get('businessId')
  if (!businessId) return apiError(400, 'invalid_request', 'businessId is required')

  const membership = businessMembership(session, businessId, ['owner', 'manager', 'staff'])
  if (!membership) return apiError(403, 'forbidden', 'You do not have access to this business')

  const tenantId = membership.tenantId
  const encoder = new TextEncoder()
  let closed = false
  let interval: ReturnType<typeof setInterval> | undefined
  let lifetime: ReturnType<typeof setTimeout> | undefined

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let lastStamp = ''

      const send = (event: string, data: unknown) => {
        if (closed) return
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      const close = () => {
        if (closed) return
        closed = true
        if (interval) clearInterval(interval)
        if (lifetime) clearTimeout(lifetime)
        try {
          controller.close()
        } catch {
          // Already closed by the client.
        }
      }

      const tick = async () => {
        if (closed) return
        try {
          const rows = await listOrders(tenantId, businessId)
          const stamp = rows.reduce((max, row) => Math.max(max, row.order.updatedAt.getTime()), 0)
          if (String(stamp) !== lastStamp) {
            lastStamp = String(stamp)
            send('orders', { updatedAt: stamp, count: rows.length })
          } else {
            send('ping', { at: Date.now() })
          }
        } catch {
          // Keep the connection; the next tick may recover.
        }
      }

      send('ready', { businessId })
      void tick()
      interval = setInterval(() => void tick(), TICK_MS)
      lifetime = setTimeout(close, MAX_LIFETIME_MS)
      request.signal.addEventListener('abort', close)
    },
    cancel() {
      closed = true
      if (interval) clearInterval(interval)
      if (lifetime) clearTimeout(lifetime)
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  })
}
