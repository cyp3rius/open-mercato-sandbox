import { parsePlatformTripCsv } from '../platformSync/parsePlatformTripCsv'
import { isPlatformIngestedTrip, readTripIngestSource } from '../platformSync/platformTripIngest'

const sampleCsv = `externalTripId,platformDriverId,startedAt,revenueAmount,status,endedAt,distanceKm,paymentType,currencyCode
bolt-trip-001,driver-bolt-42,2026-08-20T08:15:00,45.50,completed,2026-08-20T08:42:00,12.3,electronic,PLN
bolt-trip-002,driver-bolt-42,2026-08-20T14:00:00,28.00,completed,2026-08-20T14:18:00,6.1,cash,PLN`

describe('parsePlatformTripCsv', () => {
  it('parses sample rows', () => {
    const result = parsePlatformTripCsv({
      csvText: sampleCsv,
      platform: 'bolt',
      ingestSource: 'platform_csv',
    })
    expect(result.errors).toEqual([])
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]?.externalTripId).toBe('bolt-trip-001')
    expect(result.rows[1]?.paymentType).toBe('cash')
  })

  it('rejects missing required headers', () => {
    const result = parsePlatformTripCsv({
      csvText: 'externalTripId,startedAt\nabc,2026-01-01T10:00:00',
      platform: 'bolt',
      ingestSource: 'platform_csv',
    })
    expect(result.rows).toEqual([])
    expect(result.errors[0]?.message).toContain('platformDriverId')
  })

  it('flags platform column mismatch', () => {
    const result = parsePlatformTripCsv({
      csvText:
        'externalTripId,platformDriverId,startedAt,revenueAmount,platform\nx,d1,2026-01-01T10:00:00,10,uber',
      platform: 'bolt',
      ingestSource: 'platform_csv',
    })
    expect(result.rows).toEqual([])
    expect(result.errors[0]?.message).toContain('must match')
  })
})

describe('platformTripIngest', () => {
  it('detects platform ingest source', () => {
    expect(readTripIngestSource({ ingestSource: 'platform_csv' })).toBe('platform_csv')
    expect(isPlatformIngestedTrip({ ingestSource: 'platform_sync' })).toBe(true)
    expect(isPlatformIngestedTrip({})).toBe(false)
  })
})
