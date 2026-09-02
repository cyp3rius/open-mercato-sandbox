import type { PlatformTripUpsertInput } from '../../../data/validators'
import type { TaxiFleetTripPlatform } from '../../tripPlatforms'
import type { PlatformTripAdapterRow } from './types'

type VendorTripRecord = Record<string, unknown>

function readString(record: VendorTripRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

function readNumber(record: VendorTripRecord, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.trim().replace(',', '.'))
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function parseVendorStatus(value: string | null): PlatformTripUpsertInput['status'] {
  const normalized = (value ?? 'completed').trim().toLowerCase()
  if (normalized === 'cancelled' || normalized === 'canceled') return 'cancelled'
  if (normalized === 'paid') return 'paid'
  return 'completed'
}

function parseVendorPaymentType(value: string | null): PlatformTripUpsertInput['paymentType'] {
  const normalized = (value ?? 'electronic').trim().toLowerCase()
  if (normalized === 'cash') return 'cash'
  if (normalized === 'card') return 'card'
  if (normalized === 'electronic' || normalized === 'online' || normalized === 'app') return 'electronic'
  if (normalized === 'transfer') return 'transfer'
  return 'electronic'
}

function parseVendorDate(value: string | null): Date | null {
  if (!value) return null
  const candidate = value.includes('T') ? value : value.replace(' ', 'T')
  const parsed = new Date(candidate)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function mapVendorTripRecord(
  platform: TaxiFleetTripPlatform,
  record: VendorTripRecord,
): PlatformTripAdapterRow | null {
  const externalTripId = readString(
    record,
    'order_reference',
    'externalTripId',
    'external_trip_id',
    'tripId',
    'trip_id',
    'orderId',
    'order_id',
    'id',
  )
  const platformDriverId = readString(
    record,
    'platformDriverId',
    'platform_driver_id',
    'driverId',
    'driver_id',
    'driverUuid',
    'driver_uuid',
  )
  const startedAtRaw = readString(record, 'startedAt', 'started_at', 'startTime', 'start_time', 'pickup_time')
  const revenueAmount = readNumber(record, 'revenueAmount', 'revenue_amount', 'price', 'amount', 'gross_amount')
  if (!externalTripId || !platformDriverId || !startedAtRaw || revenueAmount == null) return null

  const startedAt = parseVendorDate(startedAtRaw)
  if (!startedAt) return null

  const endedAtRaw = readString(record, 'endedAt', 'ended_at', 'endTime', 'end_time', 'dropoff_time')
  const endedAt = endedAtRaw ? parseVendorDate(endedAtRaw) : null
  const distanceKm = readNumber(record, 'distanceKm', 'distance_km', 'distance')
  const currencyCode = readString(record, 'currencyCode', 'currency_code', 'currency') ?? 'PLN'
  const status = parseVendorStatus(readString(record, 'status', 'trip_status', 'order_status'))
  const paymentType = parseVendorPaymentType(
    readString(record, 'paymentType', 'payment_type', 'payment_method'),
  )

  return {
    platform,
    externalTripId,
    platformDriverId,
    status,
    startedAt,
    endedAt,
    distanceKm,
    revenueAmount,
    currencyCode: currencyCode.toUpperCase(),
    paymentType,
    rawExternalStatus: readString(record, 'status', 'trip_status', 'order_status'),
  }
}

export function extractVendorTripList(payload: unknown): VendorTripRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is VendorTripRecord => Boolean(item && typeof item === 'object'))
  }
  if (!payload || typeof payload !== 'object') return []
  const record = payload as VendorTripRecord
  const candidates = [record.items, record.data, record.trips, record.orders, record.results]
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is VendorTripRecord => Boolean(item && typeof item === 'object'))
    }
  }
  return []
}
