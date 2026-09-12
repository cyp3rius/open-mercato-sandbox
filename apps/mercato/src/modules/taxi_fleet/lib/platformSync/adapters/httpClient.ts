import { PlatformTripAdapterError } from './types'

const DEFAULT_MAX_RETRIES = 3

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function sanitizeErrorMessage(status: number, body: string): string {
  const trimmed = body.trim().slice(0, 200)
  if (!trimmed) return `Upstream request failed (${status})`
  return `Upstream request failed (${status})`
}

export async function fetchJsonWithRetry(
  url: string,
  init: RequestInit,
  options?: { maxRetries?: number },
): Promise<unknown> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES
  let attempt = 0
  while (attempt <= maxRetries) {
    const response = await fetch(url, init)
    if (response.status === 429 && attempt < maxRetries) {
      const retryAfterHeader = response.headers.get('retry-after')
      const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN
      const delayMs = Number.isFinite(retryAfterSeconds)
        ? Math.max(retryAfterSeconds, 1) * 1000
        : Math.min(1000 * 2 ** attempt, 30_000)
      await sleep(delayMs)
      attempt += 1
      continue
    }
    const text = await response.text().catch(() => '')
    if (!response.ok) {
      throw new PlatformTripAdapterError(sanitizeErrorMessage(response.status, text), {
        status: response.status,
        retryable: response.status === 429 || response.status >= 500,
      })
    }
    if (!text.trim()) return null
    try {
      return JSON.parse(text) as unknown
    } catch {
      throw new PlatformTripAdapterError('Upstream returned invalid JSON', { status: 502 })
    }
  }
  throw new PlatformTripAdapterError('Upstream rate limit exceeded', { status: 429, retryable: true })
}

export async function fetchAccessToken(params: {
  tokenUrl: string
  clientId: string
  clientSecret: string
  scope?: string
}): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: params.clientId,
    client_secret: params.clientSecret,
  })
  if (params.scope?.trim()) body.set('scope', params.scope.trim())

  const payload = (await fetchJsonWithRetry(params.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })) as { access_token?: string } | null

  const token = payload && typeof payload.access_token === 'string' ? payload.access_token.trim() : ''
  if (!token) {
    throw new PlatformTripAdapterError('OAuth token response missing access_token', { status: 502 })
  }
  return token
}

export function joinUrl(base: string, path: string): string {
  const normalizedBase = base.trim().replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBase}${normalizedPath}`
}
