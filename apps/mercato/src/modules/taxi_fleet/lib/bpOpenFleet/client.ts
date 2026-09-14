import type { TaxiFleetBpOpenFleetSettings } from '../taxiFleetSettings'

export type BpNormalizedTransaction = {
  transactionId: string
  cardNumber: string
  grossAmount: number
  quantity: number | null
  productDescription: string | null
  siteName: string | null
  transactionDateTime: string | null
  vehicleRegistrationNumber: string | null
}

export function normalizeBpCardNumber(value: string | null | undefined): string {
  if (!value) return ''
  return value.replace(/[\s-]+/g, '').toUpperCase()
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

export function normalizeBpTransaction(raw: Record<string, unknown>): BpNormalizedTransaction | null {
  const transactionId =
    asString(raw.transactionUniqueId)
    ?? asString(raw.transactionId)
    ?? asString(raw.transactionVoucherNumber)
  const cardNumber = normalizeBpCardNumber(
    asString(raw.fullCardNumber) ?? asString(raw.cardSerialNumber) ?? asString(raw.embossingLineOne),
  )
  const gross =
    asNumber(raw.grossInvoiceValueInInvoiceCurrency)
    ?? asNumber(raw.grossValueInSupplyCurrency)
    ?? asNumber(raw.originalGrossValueInInvoiceCurrency)
    ?? asNumber(raw.grossUnrebatedInvoiceValueInInvoiceCurrency)
  if (!transactionId || !cardNumber || gross == null) return null
  return {
    transactionId,
    cardNumber,
    grossAmount: Math.round(gross * 100) / 100,
    quantity: asNumber(raw.quantity),
    productDescription: asString(raw.productDescription) ?? asString(raw.productType),
    siteName: asString(raw.siteName),
    transactionDateTime: asString(raw.transactionDateTime),
    vehicleRegistrationNumber: asString(raw.vehicleRegistrationNumber),
  }
}

export function filterAndSumBpTransactionsByCard(
  transactions: BpNormalizedTransaction[],
  cardNumber: string,
): { matched: BpNormalizedTransaction[]; grossTotal: number } {
  const wanted = normalizeBpCardNumber(cardNumber)
  const matched = transactions.filter((tx) => tx.cardNumber === wanted)
  const grossTotal = Math.round(matched.reduce((sum, tx) => sum + tx.grossAmount, 0) * 100) / 100
  return { matched, grossTotal }
}

function joinUrl(base: string, path: string): string {
  const left = base.replace(/\/+$/, '')
  const right = path.replace(/^\/+/, '')
  return `${left}/${right}`
}

export class BpOpenFleetClient {
  private accessToken: string | null = null
  private tokenExpiresAt = 0

  constructor(private readonly settings: TaxiFleetBpOpenFleetSettings) {}

  private assertConfigured(): void {
    if (!this.settings.enabled) {
      throw new Error('BP Open Fleet integration is disabled.')
    }
    if (!this.settings.clientId?.trim() || !this.settings.clientSecret?.trim()) {
      throw new Error('BP Open Fleet client credentials are not configured.')
    }
    if (!this.settings.apiPrefix?.trim()) {
      throw new Error('BP Open Fleet API prefix is not configured.')
    }
  }

  async getAccessToken(): Promise<string> {
    this.assertConfigured()
    const now = Date.now()
    if (this.accessToken && now < this.tokenExpiresAt - 30_000) {
      return this.accessToken
    }
    const base = this.settings.apiBaseUrl?.trim() || 'https://api.fleet.bp.com'
    const form = new FormData()
    form.set('client_id', this.settings.clientId.trim())
    form.set('client_secret', this.settings.clientSecret.trim())
    const response = await fetch(joinUrl(base, 'authentication/v1.0/token'), {
      method: 'POST',
      body: form,
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`BP Open Fleet auth failed (${response.status}): ${text.slice(0, 300)}`)
    }
    const json = (await response.json()) as {
      access_token?: string
      expires_in?: number
    }
    if (!json.access_token) {
      throw new Error('BP Open Fleet auth response missing access_token.')
    }
    this.accessToken = json.access_token
    const expiresIn = typeof json.expires_in === 'number' && json.expires_in > 0 ? json.expires_in : 3600
    this.tokenExpiresAt = now + expiresIn * 1000
    return this.accessToken
  }

  async listTransactions(params: {
    startDateTime: string
    endDateTime: string
    pageSize?: number
  }): Promise<BpNormalizedTransaction[]> {
    this.assertConfigured()
    const token = await this.getAccessToken()
    const base = this.settings.apiBaseUrl?.trim() || 'https://api.fleet.bp.com'
    const prefix = this.settings.apiPrefix.trim().replace(/^\/+|\/+$/g, '')
    const pageSize = Math.min(Math.max(params.pageSize ?? 200, 1), 1000)
    const collected: BpNormalizedTransaction[] = []
    let page = 1
    for (;;) {
      const query = new URLSearchParams({
        StartDateTime: params.startDateTime,
        EndDateTime: params.endDateTime,
        Page: String(page),
        PageSize: String(pageSize),
      })
      if (this.settings.authorityId?.trim()) {
        query.append('AuthorityIds', this.settings.authorityId.trim())
      }
      if (this.settings.parentId?.trim()) {
        query.append('ParentIds', this.settings.parentId.trim())
      }
      const response = await fetch(joinUrl(base, `${prefix}/v1.0/transactions?${query}`), {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-correlation-id': crypto.randomUUID(),
          Accept: 'application/json',
        },
      })
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`BP Open Fleet transactions failed (${response.status}): ${text.slice(0, 300)}`)
      }
      const json = (await response.json()) as unknown
      const items = extractTransactionItems(json)
      if (!items.length) break
      for (const item of items) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) continue
        const normalized = normalizeBpTransaction(item as Record<string, unknown>)
        if (normalized) collected.push(normalized)
      }
      if (items.length < pageSize) break
      page += 1
      if (page > 100) break
    }
    return collected
  }
}

function extractTransactionItems(json: unknown): unknown[] {
  if (Array.isArray(json)) return json
  if (!json || typeof json !== 'object') return []
  const record = json as Record<string, unknown>
  for (const key of ['items', 'transactions', 'data', 'results', 'value']) {
    const value = record[key]
    if (Array.isArray(value)) return value
  }
  return []
}
