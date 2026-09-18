import type { TaxiFleetPaypalSettings } from '../taxiFleetSettings'
import { taxiFleetDebugLog } from '../debugEnv'

type PayPalAccessTokenResponse = {
  access_token?: string
  expires_in?: number
}

type PayPalLink = {
  rel?: string
  href?: string
}

type PayPalCreateOrderResponse = {
  id?: string
  links?: PayPalLink[]
}

export type PayPalCaptureResponse = {
  status?: string
}

export type PayPalOrderResult = {
  orderId: string
  approvalUrl: string
}

const tokenCache = new Map<string, { value: string; expiresAt: number }>()

function paypalApiBase(mode: 'sandbox' | 'live'): string {
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
}

function assertPayPalConfigured(settings: TaxiFleetPaypalSettings): void {
  if (!settings.enabled) {
    throw new Error('PayPal is disabled in taxi fleet settings.')
  }
  if (!settings.clientId?.trim() || !settings.clientSecret?.trim()) {
    throw new Error('PayPal is not configured (client ID / client secret).')
  }
}

function cacheKey(settings: TaxiFleetPaypalSettings): string {
  return `${settings.mode}:${settings.clientId}`
}

async function getAccessToken(settings: TaxiFleetPaypalSettings): Promise<string> {
  assertPayPalConfigured(settings)
  const key = cacheKey(settings)
  const cached = tokenCache.get(key)
  const now = Date.now()
  if (cached && cached.expiresAt > now + 30_000) {
    taxiFleetDebugLog('paypal', 'auth token cache hit', { mode: settings.mode })
    return cached.value
  }

  taxiFleetDebugLog('paypal', 'requesting oauth token', {
    mode: settings.mode,
    clientIdPrefix: settings.clientId.trim().slice(0, 8),
  })

  const credentials = `${settings.clientId.trim()}:${settings.clientSecret.trim()}`
  const res = await fetch(`${paypalApiBase(settings.mode)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(credentials).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    const body = await res.text()
    taxiFleetDebugLog('paypal', 'oauth failed', { status: res.status, body })
    throw new Error(`PayPal auth failed (${res.status}): ${body}`)
  }

  const data = (await res.json()) as PayPalAccessTokenResponse
  if (!data.access_token) {
    throw new Error('PayPal auth response missing access_token.')
  }

  const expiresInMs = Math.max(60, Number(data.expires_in) || 3000) * 1000
  tokenCache.set(key, {
    value: data.access_token,
    expiresAt: now + expiresInMs,
  })
  taxiFleetDebugLog('paypal', 'oauth ok', {
    mode: settings.mode,
    expiresInSec: Math.round(expiresInMs / 1000),
  })
  return data.access_token
}

function formatPayPalAmount(value: unknown): string {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value))
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Invalid totalPrice for PayPal order.')
  }
  return n.toFixed(2)
}

export function buildPaymentConfirmReturnUrl(appBaseUrl: string, paymentHash: string): string {
  const base = appBaseUrl.replace(/\/$/, '')
  return `${base}/api/taxi_fleet/trips/payment/confirm/${encodeURIComponent(paymentHash)}`
}

export function buildPaymentCancelUrl(params: {
  settings: TaxiFleetPaypalSettings
  requestId: string
  paymentHash: string
  appBaseUrl: string
}): string {
  const custom = params.settings.paymentCancelUrl?.trim()
  if (custom) {
    return custom.replace('{requestId}', encodeURIComponent(params.requestId))
  }
  const confirmationBase = params.settings.confirmationPageBase?.trim()
  if (confirmationBase) {
    return `${confirmationBase.replace(/\/$/, '')}/${encodeURIComponent(params.requestId)}?payment=cancelled`
  }
  return `${buildPaymentConfirmReturnUrl(params.appBaseUrl, params.paymentHash)}?cancelled=1`
}

export function buildConfirmationRedirectUrl(
  settings: TaxiFleetPaypalSettings,
  requestId: string,
  query?: Record<string, string>,
): string {
  const base = settings.confirmationPageBase?.trim()
  if (!base) {
    throw new Error('PayPal confirmationPageBase is not configured.')
  }
  const url = new URL(`${base.replace(/\/$/, '')}/${encodeURIComponent(requestId)}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value)
    }
  }
  return url.toString()
}

export async function createPayPalOrder(params: {
  settings: TaxiFleetPaypalSettings
  requestId: string
  paymentHash: string
  totalPrice: unknown
  locale: 'pl' | 'en'
  appBaseUrl: string
}): Promise<PayPalOrderResult> {
  const token = await getAccessToken(params.settings)
  const currency = (params.settings.currency || 'PLN').toUpperCase()
  const amount = formatPayPalAmount(params.totalPrice)
  const description = `RS Moto Taxi — ${params.requestId}`
  const returnUrl = buildPaymentConfirmReturnUrl(params.appBaseUrl, params.paymentHash)
  const cancelUrl = buildPaymentCancelUrl({
    settings: params.settings,
    requestId: params.requestId,
    paymentHash: params.paymentHash,
    appBaseUrl: params.appBaseUrl,
  })

  taxiFleetDebugLog('paypal', 'create order request', {
    mode: params.settings.mode,
    requestId: params.requestId,
    amount,
    currency,
    locale: params.locale,
    returnUrl,
    cancelUrl,
  })

  const res = await fetch(`${paypalApiBase(params.settings.mode)}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: params.requestId,
          description,
          custom_id: params.requestId,
          amount: {
            currency_code: currency,
            value: amount,
          },
        },
      ],
      application_context: {
        brand_name: 'RS Moto Taxi',
        locale: params.locale === 'en' ? 'en-US' : 'pl-PL',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    taxiFleetDebugLog('paypal', 'create order failed', { status: res.status, body })
    throw new Error(`PayPal create order failed (${res.status}): ${body}`)
  }

  const data = (await res.json()) as PayPalCreateOrderResponse
  const orderId = data.id
  const approvalUrl = data.links?.find((link) => link.rel === 'approve')?.href
  if (!orderId || !approvalUrl) {
    taxiFleetDebugLog('paypal', 'create order missing fields', { data })
    throw new Error('PayPal create order response missing order id or approval URL.')
  }
  taxiFleetDebugLog('paypal', 'create order ok', { orderId, approvalUrl })
  return { orderId, approvalUrl }
}

export async function capturePayPalOrder(
  settings: TaxiFleetPaypalSettings,
  orderId: string,
): Promise<PayPalCaptureResponse> {
  taxiFleetDebugLog('paypal', 'capture order request', { mode: settings.mode, orderId })
  const token = await getAccessToken(settings)
  const res = await fetch(
    `${paypalApiBase(settings.mode)}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  )
  if (!res.ok) {
    const body = await res.text()
    taxiFleetDebugLog('paypal', 'capture order failed', { orderId, status: res.status, body })
    throw new Error(`PayPal capture failed (${res.status}): ${body}`)
  }
  const data = (await res.json()) as PayPalCaptureResponse
  taxiFleetDebugLog('paypal', 'capture order ok', { orderId, status: data.status ?? null })
  return data
}
