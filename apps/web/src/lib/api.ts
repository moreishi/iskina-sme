import { randomUUID } from 'node:crypto'

export interface ApiErrorBody {
  error: { code: string; message: string; requestId: string }
}

export function apiError(status: number, code: string, message: string): Response {
  const body: ApiErrorBody = { error: { code, message, requestId: randomUUID() } }
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } })
}

export function apiJson(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } })
}

export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || null
  return request.headers.get('x-real-ip')
}

export function userAgent(request: Request): string | null {
  return request.headers.get('user-agent')
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value = await request.json()
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
