export interface HttpResult<T> {
  status: number
  body: T
  ms: number
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class HttpClient {
  constructor(
    readonly baseUrl: string,
    private token: string | null = null,
  ) {}

  setToken(token: string | null): void {
    this.token = token
  }

  getToken(): string | null {
    return this.token
  }

  async request<T = Record<string, unknown>>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<HttpResult<T>> {
    const started = performance.now()
    const headers: Record<string, string> = { accept: 'application/json' }
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (this.token) headers.authorization = `Bearer ${this.token}`

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      })
    } catch (error) {
      throw new ApiError(
        0,
        'network',
        error instanceof Error ? error.message : 'Network error',
        null,
      )
    }

    const text = await response.text()
    const parsed = text ? safeJson(text) : {}
    const ms = Math.round(performance.now() - started)

    if (!response.ok) {
      const error = (parsed as { error?: { code?: string; message?: string } }).error
      throw new ApiError(
        response.status,
        error?.code ?? 'error',
        error?.message ?? `HTTP ${response.status}`,
        parsed,
      )
    }

    return { status: response.status, body: parsed as T, ms }
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text }
  }
}

export async function waitForOrderEvent(input: {
  baseUrl: string
  token: string
  businessId: string
  timeoutMs?: number
}): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 15_000)
  try {
    const response = await fetch(
      `${input.baseUrl}/api/v1/merchant/events?businessId=${encodeURIComponent(input.businessId)}`,
      {
        headers: {
          authorization: `Bearer ${input.token}`,
          accept: 'text/event-stream',
        },
        signal: controller.signal,
      },
    )
    if (!response.ok || !response.body) {
      throw new Error(`SSE refused with ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let event: string | null = null

    while (true) {
      const { value, done } = await reader.read()
      if (done) throw new Error('SSE closed before an orders event')
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const raw of lines) {
        const line = raw.trimEnd()
        if (line === '') {
          if (event === 'orders') {
            controller.abort()
            return
          }
          event = null
          continue
        }
        if (line.startsWith('event:')) event = line.slice(6).trim()
      }
    }
  } finally {
    clearTimeout(timer)
    controller.abort()
  }
}
