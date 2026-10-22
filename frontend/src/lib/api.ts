export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function readCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))

  return match ? decodeURIComponent(match[1]) : ''
}

function buildHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers)
  const method = (init.method ?? 'GET').toUpperCase()

  headers.set('Accept', 'application/json')

  if (init.body) {
    headers.set('Content-Type', 'application/json')
  }

  if (method !== 'GET' && method !== 'HEAD') {
    headers.set('X-XSRF-TOKEN', readCookie('XSRF-TOKEN'))
  }

  return headers
}

async function send(path: string, init: RequestInit): Promise<Response> {
  return fetch(path, {
    ...init,
    headers: buildHeaders(init),
    credentials: 'same-origin',
  })
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response = await send(path, init)

  if (response.status === 419) {
    await fetch('/api/auth/me', {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    })
    response = await send(path, init)
  }

  const text = await response.text()
  let payload: unknown = null

  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    const data = payload as { message?: string; errors?: Record<string, string[]> } | null
    const firstError = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined
    const message = firstError ?? data?.message ?? 'Не удалось выполнить запрос'

    throw new ApiError(message, response.status)
  }

  return payload as T
}
