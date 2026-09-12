import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  clearBoltAccessTokenCache,
  getBoltAccessToken,
} from '../platformSync/adapters/bolt/token'
import { testBoltConnection } from '../platformSync/adapters/bolt/client'
import {
  BOLT_DEFAULT_API_BASE_URL,
  BOLT_OIDC_TOKEN_URL,
  BOLT_OAUTH_SCOPE,
} from '../platformSync/adapters/bolt/constants'
import {
  isPlatformSyncPlatformConfigured,
  listEnabledPlatformSyncPlatforms,
} from '../platformSync/platformSyncCredentials'
import { defaultPlatformSyncSettings } from '../taxiFleetSettings'

const fixturesDir = join(__dirname, '../platformSync/fixtures')

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('Bolt OAuth token cache', () => {
  afterEach(() => {
    clearBoltAccessTokenCache()
  })

  it('reuses cached token until refresh skew', async () => {
    let tokenCalls = 0
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === BOLT_OIDC_TOKEN_URL) {
        tokenCalls += 1
        return jsonResponse({
          access_token: `token-${tokenCalls}`,
          expires_in: 600,
          token_type: 'Bearer',
          scope: BOLT_OAUTH_SCOPE,
        })
      }
      throw new Error(`Unexpected URL ${url}`)
    }) as typeof fetch

    const first = await getBoltAccessToken({
      clientId: 'client-a',
      clientSecret: 'secret-a',
      nowMs: 1_000_000,
      fetchImpl,
    })
    const second = await getBoltAccessToken({
      clientId: 'client-a',
      clientSecret: 'secret-a',
      nowMs: 1_000_000 + 500_000,
      fetchImpl,
    })
    expect(first).toBe('token-1')
    expect(second).toBe('token-1')
    expect(tokenCalls).toBe(1)
  })

  it('refreshes when within skew of expiry', async () => {
    let tokenCalls = 0
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === BOLT_OIDC_TOKEN_URL) {
        tokenCalls += 1
        return jsonResponse({
          access_token: `token-${tokenCalls}`,
          expires_in: 600,
          token_type: 'Bearer',
          scope: BOLT_OAUTH_SCOPE,
        })
      }
      throw new Error(`Unexpected URL ${url}`)
    }) as typeof fetch

    await getBoltAccessToken({
      clientId: 'client-b',
      clientSecret: 'secret-b',
      nowMs: 0,
      fetchImpl,
    })
    const refreshed = await getBoltAccessToken({
      clientId: 'client-b',
      clientSecret: 'secret-b',
      nowMs: 540_001,
      fetchImpl,
    })
    expect(refreshed).toBe('token-2')
    expect(tokenCalls).toBe(2)
  })
})

describe('testBoltConnection', () => {
  afterEach(() => {
    clearBoltAccessTokenCache()
  })

  it('authenticates and lists companies', async () => {
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === BOLT_OIDC_TOKEN_URL) {
        return jsonResponse({
          access_token: 'live-token',
          expires_in: 600,
          token_type: 'Bearer',
          scope: BOLT_OAUTH_SCOPE,
        })
      }
      if (url.includes('/fleetIntegration/v1/getCompanies')) {
        expect(init?.headers && (init.headers as Record<string, string>).authorization).toBe(
          'Bearer live-token',
        )
        return jsonResponse({
          code: 0,
          message: 'OK',
          data: { companies: [{ company_id: 42, name: 'Fleet Co' }] },
        })
      }
      throw new Error(`Unexpected URL ${url}`)
    }) as typeof fetch

    const result = await testBoltConnection({
      credentials: {
        enabled: true,
        apiBaseUrl: '',
        clientId: 'cid',
        clientSecret: 'csecret',
        refreshToken: '',
        companyId: '42',
      },
      fetchImpl,
    })

    expect(result).toEqual({
      ok: true,
      apiBaseUrl: BOLT_DEFAULT_API_BASE_URL,
      companyCount: 1,
      companyIdMatched: true,
    })
  })
})

describe('platformSyncCredentials (Bolt)', () => {
  it('requires clientId + companyId for Bolt (apiBaseUrl optional)', () => {
    const platformSync = defaultPlatformSyncSettings()
    platformSync.bolt = {
      enabled: true,
      apiBaseUrl: '',
      clientId: 'id',
      clientSecret: 'secret',
      refreshToken: '',
      companyId: '99',
    }
    expect(isPlatformSyncPlatformConfigured(platformSync.bolt, 'bolt')).toBe(true)
    expect(listEnabledPlatformSyncPlatforms(platformSync)).toEqual(['bolt'])
  })

  it('rejects Bolt without companyId', () => {
    expect(
      isPlatformSyncPlatformConfigured(
        {
          enabled: true,
          apiBaseUrl: BOLT_DEFAULT_API_BASE_URL,
          clientId: 'id',
          clientSecret: 'secret',
          refreshToken: '',
          companyId: '',
        },
        'bolt',
      ),
    ).toBe(false)
  })

  it('still requires apiBaseUrl for Uber', () => {
    expect(
      isPlatformSyncPlatformConfigured(
        {
          enabled: true,
          apiBaseUrl: '',
          clientId: 'id',
          clientSecret: 'secret',
          refreshToken: '',
          companyId: '',
        },
        'uber',
      ),
    ).toBe(false)
  })
})

describe('getBoltFleetOrders window', () => {
  afterEach(() => {
    clearBoltAccessTokenCache()
  })

  it('sends unix timestamps from Date window bounds', async () => {
    const windowFrom = new Date('2026-08-25T10:00:00.000Z')
    const windowTo = new Date('2026-08-26T12:00:00.000Z')
    let capturedBody: Record<string, unknown> | null = null
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === BOLT_OIDC_TOKEN_URL) {
        return jsonResponse({
          access_token: 'live-token',
          expires_in: 600,
          token_type: 'Bearer',
          scope: BOLT_OAUTH_SCOPE,
        })
      }
      if (url.includes('/fleetIntegration/v1/getFleetOrders')) {
        capturedBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
        return jsonResponse({
          code: 0,
          message: 'OK',
          data: { total_orders: 3, orders: [] },
        })
      }
      throw new Error(`Unexpected URL ${url}`)
    }) as typeof fetch

    const { getBoltFleetOrders } = await import('../platformSync/adapters/bolt/client')
    await getBoltFleetOrders({
      credentials: {
        enabled: true,
        apiBaseUrl: '',
        clientId: 'cid',
        clientSecret: 'csecret',
        refreshToken: '',
        companyId: '42',
      },
      windowFrom,
      windowTo,
      fetchImpl,
    })

    expect(capturedBody).toMatchObject({
      company_id: 42,
      start_ts: Math.floor(windowFrom.getTime() / 1000),
      end_ts: Math.floor(windowTo.getTime() / 1000),
    })
  })
})

describe('Bolt trip history CSV fixture', () => {
  it('keeps portal headers including trailing space on plate column', () => {
    const raw = readFileSync(join(fixturesDir, 'sample-bolt-trip-history.csv'), 'utf8')
    const headerLine = raw.split(/\r?\n/)[0] ?? ''
    const headers = headerLine.split(',')
    expect(headers).toContain('Data')
    expect(headers).toContain('Numer rejestracyjny ')
    expect(headers).toContain('Cena przejazdu|ZŁ')
    expect(headers).toContain('Indywidualny numer identyfikacyjny')
    expect(headers).not.toContain('order_reference')
  })
})
