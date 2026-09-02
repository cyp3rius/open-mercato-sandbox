import { fetchJsonWithRetry } from '../httpClient'
import { PlatformTripAdapterError } from '../types'
import {
  BOLT_OIDC_TOKEN_URL,
  BOLT_OAUTH_SCOPE,
  BOLT_TOKEN_REFRESH_SKEW_MS,
} from './constants'

type TokenCacheEntry = {
  accessToken: string
  expiresAtMs: number
}

const tokenCache = new Map<string, TokenCacheEntry>()

export function clearBoltAccessTokenCache(): void {
  tokenCache.clear()
}

function cacheKey(clientId: string): string {
  return clientId.trim()
}

export async function getBoltAccessToken(params: {
  clientId: string
  clientSecret: string
  nowMs?: number
  fetchImpl?: typeof fetch
}): Promise<string> {
  const clientId = params.clientId.trim()
  const clientSecret = params.clientSecret.trim()
  if (!clientId || !clientSecret) {
    throw new PlatformTripAdapterError('Bolt OAuth credentials are not configured', { status: 400 })
  }

  const nowMs = params.nowMs ?? Date.now()
  const key = cacheKey(clientId)
  const cached = tokenCache.get(key)
  if (cached && cached.expiresAtMs - BOLT_TOKEN_REFRESH_SKEW_MS > nowMs) {
    return cached.accessToken
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: BOLT_OAUTH_SCOPE,
  })

  const previousFetch = globalThis.fetch
  if (params.fetchImpl) {
    globalThis.fetch = params.fetchImpl as typeof fetch
  }
  let payload: { access_token?: string; expires_in?: number } | null
  try {
    payload = (await fetchJsonWithRetry(BOLT_OIDC_TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })) as { access_token?: string; expires_in?: number } | null
  } finally {
    if (params.fetchImpl) {
      globalThis.fetch = previousFetch
    }
  }

  const accessToken =
    payload && typeof payload.access_token === 'string' ? payload.access_token.trim() : ''
  if (!accessToken) {
    throw new PlatformTripAdapterError('Bolt OAuth token response missing access_token', { status: 502 })
  }

  const expiresInSeconds =
    payload && typeof payload.expires_in === 'number' && Number.isFinite(payload.expires_in)
      ? Math.max(payload.expires_in, 1)
      : 600

  tokenCache.set(key, {
    accessToken,
    expiresAtMs: nowMs + expiresInSeconds * 1000,
  })

  return accessToken
}
