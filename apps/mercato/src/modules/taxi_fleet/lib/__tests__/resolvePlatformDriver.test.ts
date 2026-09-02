import {
  filterPlatformTripRowsForKnownDrivers,
  normalizePlatformDriverId,
} from '../platformSync/resolvePlatformDriver'
import type { PlatformTripAdapterRow } from '../platformSync/adapters/types'

function sampleRow(platformDriverId: string): PlatformTripAdapterRow {
  return {
    platform: 'bolt',
    externalTripId: `trip-${platformDriverId}`,
    platformDriverId,
    status: 'completed',
    startedAt: new Date('2026-08-20T08:00:00Z'),
    endedAt: new Date('2026-08-20T08:30:00Z'),
    distanceKm: 12,
    revenueAmount: 42.5,
    currencyCode: 'PLN',
    paymentType: 'electronic',
    rawExternalStatus: 'completed',
  }
}

describe('normalizePlatformDriverId', () => {
  it('trims whitespace and rejects empty values', () => {
    expect(normalizePlatformDriverId('  driver-1  ')).toBe('driver-1')
    expect(normalizePlatformDriverId('')).toBeNull()
    expect(normalizePlatformDriverId('   ')).toBeNull()
    expect(normalizePlatformDriverId(null)).toBeNull()
  })

  it('normalizes UUID driver IDs case-insensitively', () => {
    expect(normalizePlatformDriverId('A1B2C3D4-E5F6-7890-ABCD-EF1234567890')).toBe(
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    )
  })
})

describe('filterPlatformTripRowsForKnownDrivers', () => {
  it('keeps only rows whose platformDriverId exists in CRM', () => {
    const known = new Set(['driver-1', 'driver-2'])
    const result = filterPlatformTripRowsForKnownDrivers(
      [sampleRow('driver-1'), sampleRow('unknown'), sampleRow('  driver-2  ')],
      known,
    )
    expect(result.rows).toHaveLength(2)
    expect(result.rows.map((row) => row.platformDriverId)).toEqual(['driver-1', '  driver-2  '])
    expect(result.skippedCount).toBe(1)
  })

  it('skips all rows when no CRM drivers have platform IDs', () => {
    const result = filterPlatformTripRowsForKnownDrivers([sampleRow('driver-1')], new Set())
    expect(result.rows).toEqual([])
    expect(result.skippedCount).toBe(1)
  })

  it('filters Uber CSV rows to known Driver UUID values', () => {
    const uberRow = (driverId: string): PlatformTripAdapterRow => ({
      ...sampleRow(driverId),
      platform: 'uber',
      externalTripId: `uber-${driverId}`,
    })
    const result = filterPlatformTripRowsForKnownDrivers(
      [uberRow('driver-uber-42'), uberRow('driver-unknown')],
      new Set(['driver-uber-42']),
    )
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.platformDriverId).toBe('driver-uber-42')
    expect(result.skippedCount).toBe(1)
  })

  it('filters Free CSV rows to known platformDriverId values', () => {
    const freeRow = (driverId: string): PlatformTripAdapterRow => ({
      ...sampleRow(driverId),
      platform: 'free',
      externalTripId: `free-${driverId}`,
    })
    const result = filterPlatformTripRowsForKnownDrivers(
      [freeRow('free-driver-1'), freeRow('unknown')],
      new Set(['free-driver-1']),
    )
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.platform).toBe('free')
    expect(result.skippedCount).toBe(1)
  })
})
