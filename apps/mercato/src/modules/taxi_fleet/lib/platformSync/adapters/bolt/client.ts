import type { TaxiFleetPlatformSyncPlatformSettings } from '../../../taxiFleetSettings'
import { fetchJsonWithRetry, joinUrl } from '../httpClient'
import { PlatformTripAdapterError } from '../types'
import {
  BOLT_DEFAULT_API_BASE_URL,
  BOLT_PATH_GET_COMPANIES,
  BOLT_PATH_GET_FLEET_ORDERS,
  BOLT_PATH_TEST,
} from './constants'
import { getBoltAccessToken } from './token'

export type BoltFleetOrder = Record<string, unknown>

export type BoltGetFleetOrdersData = {
  company_id?: number
  company_name?: string | null
  total_orders?: number
  orders?: BoltFleetOrder[]
}

export type BoltTestConnectionResult = {
  ok: true
  apiBaseUrl: string
  companyCount: number
  companyIdMatched: boolean | null
}

function resolveBoltApiBaseUrl(credentials: TaxiFleetPlatformSyncPlatformSettings): string {
  const configured = credentials.apiBaseUrl?.trim()
  return configured || BOLT_DEFAULT_API_BASE_URL
}

function parseCompanyId(raw: string | undefined): number | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  const asNumber = Number(trimmed)
  if (!Number.isFinite(asNumber)) return null
  return asNumber
}

function requireCompanyId(credentials: TaxiFleetPlatformSyncPlatformSettings): number {
  const companyId = parseCompanyId(credentials.companyId)
  if (companyId == null) {
    throw new PlatformTripAdapterError('Bolt company ID is not configured', { status: 400 })
  }
  return companyId
}

async function boltAuthorizedJson(params: {
  credentials: TaxiFleetPlatformSyncPlatformSettings
  path: string
  method: 'GET' | 'POST'
  body?: unknown
  fetchImpl?: typeof fetch
}): Promise<unknown> {
  const clientId = params.credentials.clientId?.trim()
  const clientSecret = params.credentials.clientSecret?.trim()
  if (!clientId || !clientSecret) {
    throw new PlatformTripAdapterError('Bolt OAuth credentials are not configured', { status: 400 })
  }

  const accessToken = await getBoltAccessToken({
    clientId,
    clientSecret,
    fetchImpl: params.fetchImpl,
  })

  const url = joinUrl(resolveBoltApiBaseUrl(params.credentials), params.path)
  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: `Bearer ${accessToken}`,
  }
  if (params.method === 'POST') {
    headers['content-type'] = 'application/json'
  }

  const previousFetch = globalThis.fetch
  if (params.fetchImpl) {
    globalThis.fetch = params.fetchImpl as typeof fetch
  }
  try {
    return await fetchJsonWithRetry(url, {
      method: params.method,
      headers,
      body: params.method === 'POST' ? JSON.stringify(params.body ?? {}) : undefined,
    })
  } finally {
    if (params.fetchImpl) {
      globalThis.fetch = previousFetch
    }
  }
}

function unwrapBoltData(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') return payload
  const record = payload as { data?: unknown; code?: number; message?: string }
  if (typeof record.code === 'number' && record.code !== 0 && record.code !== 200) {
    const message =
      typeof record.message === 'string' && record.message.trim()
        ? record.message.trim()
        : `Bolt API error code ${record.code}`
    throw new PlatformTripAdapterError(message, { status: 502 })
  }
  return record.data !== undefined ? record.data : payload
}

export function resolveBoltApiBaseUrlForDisplay(
  credentials: TaxiFleetPlatformSyncPlatformSettings,
): string {
  return resolveBoltApiBaseUrl(credentials)
}

export async function listBoltCompanies(params: {
  credentials: TaxiFleetPlatformSyncPlatformSettings
  fetchImpl?: typeof fetch
}): Promise<unknown> {
  const payload = await boltAuthorizedJson({
    credentials: params.credentials,
    path: BOLT_PATH_GET_COMPANIES,
    method: 'GET',
    fetchImpl: params.fetchImpl,
  })
  return unwrapBoltData(payload)
}

export async function testBoltConnection(params: {
  credentials: TaxiFleetPlatformSyncPlatformSettings
  fetchImpl?: typeof fetch
}): Promise<BoltTestConnectionResult> {
  const data = await listBoltCompanies(params)
  const apiBaseUrl = resolveBoltApiBaseUrl(params.credentials)
  const configuredCompanyId = parseCompanyId(params.credentials.companyId)

  let companyCount = 0
  let companyIdMatched: boolean | null = configuredCompanyId == null ? null : false

  if (Array.isArray(data)) {
    companyCount = data.length
    if (configuredCompanyId != null) {
      companyIdMatched = data.some((row) => {
        if (!row || typeof row !== 'object') return false
        const id = (row as { company_id?: unknown; id?: unknown }).company_id
          ?? (row as { id?: unknown }).id
        return Number(id) === configuredCompanyId
      })
    }
  } else if (data && typeof data === 'object') {
    const companies =
      (data as { companies?: unknown }).companies ??
      (data as { company_ids?: unknown }).company_ids ??
      (data as { items?: unknown }).items
    if (Array.isArray(companies)) {
      companyCount = companies.length
      if (configuredCompanyId != null) {
        companyIdMatched = companies.some((row) => {
          if (typeof row === 'number') return row === configuredCompanyId
          if (!row || typeof row !== 'object') return false
          const id = (row as { company_id?: unknown; id?: unknown }).company_id
            ?? (row as { id?: unknown }).id
          return Number(id) === configuredCompanyId
        })
      }
    }
  }

  return {
    ok: true,
    apiBaseUrl,
    companyCount,
    companyIdMatched,
  }
}

export async function getBoltFleetOrders(params: {
  credentials: TaxiFleetPlatformSyncPlatformSettings
  windowFrom: Date
  windowTo: Date
  limit?: number
  offset?: number
  fetchImpl?: typeof fetch
}): Promise<BoltGetFleetOrdersData> {
  const companyId = requireCompanyId(params.credentials)
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 1000)
  const offset = Math.max(params.offset ?? 0, 0)
  const startTs = Math.floor(params.windowFrom.getTime() / 1000)
  const endTs = Math.floor(params.windowTo.getTime() / 1000)

  const payload = await boltAuthorizedJson({
    credentials: params.credentials,
    path: BOLT_PATH_GET_FLEET_ORDERS,
    method: 'POST',
    body: {
      company_id: companyId,
      company_ids: [companyId],
      start_ts: startTs,
      end_ts: endTs,
      limit,
      offset,
    },
    fetchImpl: params.fetchImpl,
  })

  const data = unwrapBoltData(payload)
  if (!data || typeof data !== 'object') {
    return { orders: [], total_orders: 0 }
  }
  return data as BoltGetFleetOrdersData
}

/** Optional smoke that exercises the documented test endpoint (needs company + window). */
export async function postBoltFleetTest(params: {
  credentials: TaxiFleetPlatformSyncPlatformSettings
  windowFrom: Date
  windowTo: Date
  fetchImpl?: typeof fetch
}): Promise<unknown> {
  const companyId = requireCompanyId(params.credentials)
  const payload = await boltAuthorizedJson({
    credentials: params.credentials,
    path: BOLT_PATH_TEST,
    method: 'POST',
    body: {
      company_ids: [companyId],
      start_ts: Math.floor(params.windowFrom.getTime() / 1000),
      end_ts: Math.floor(params.windowTo.getTime() / 1000),
      limit: 1,
      offset: 0,
    },
    fetchImpl: params.fetchImpl,
  })
  return unwrapBoltData(payload)
}
