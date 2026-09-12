import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildBoltCsvExternalTripId,
  parseBoltTripHistoryCsv,
} from '../platformSync/parseBoltTripHistoryCsv'

const fixturesDir = join(__dirname, '../platformSync/fixtures')

describe('parseBoltTripHistoryCsv', () => {
  const csvText = readFileSync(join(fixturesDir, 'sample-bolt-trip-history.csv'), 'utf8')

  it('imports only Ukończone rows from fixture', () => {
    const result = parseBoltTripHistoryCsv({
      csvText,
      ingestSource: 'platform_csv',
    })
    expect(result.errors).toEqual([])
    expect(result.rows).toHaveLength(4)
    expect(result.rows.every((row) => row.status === 'completed')).toBe(true)
    expect(result.rows.every((row) => row.platform === 'bolt')).toBe(true)
    expect(result.rows.every((row) => row.externalTripId.startsWith('boltcsv:'))).toBe(true)
  })

  it('maps addresses, plate, and payment types', () => {
    const result = parseBoltTripHistoryCsv({
      csvText,
      ingestSource: 'platform_csv',
    })
    const first = result.rows[0]!
    expect(first.platformDriverId).toBe('11111111-1111-1111-1111-111111111111')
    expect(first.revenueAmount).toBe(36.9)
    expect(first.distanceKm).toBe(16.7)
    expect(first.vehiclePlate).toBe('WX10001')
    expect(first.fromAddress).toBe('ul. Przykładowa 1, Warszawa')
    expect(first.toAddress).toBe('ul. Testowa 10, Warszawa')
    expect(first.paymentType).toBe('electronic')

    const cashRow = result.rows.find((row) => row.revenueAmount === 30.42)
    expect(cashRow?.paymentType).toBe('cash')

    const businessRow = result.rows.find((row) => row.revenueAmount === 28.9)
    expect(businessRow?.paymentType).toBe('electronic')
    expect(businessRow?.platformDriverId).toBe('22222222-2222-2222-2222-222222222222')
  })

  it('builds stable synthetic externalTripId', () => {
    const a = buildBoltCsvExternalTripId({
      driverUuid: '11111111-1111-1111-1111-111111111111',
      startedAtRaw: '2026-08-15 15:14',
      route: 'ul. Przykładowa 1, Warszawa → ul. Testowa 10, Warszawa',
      revenueRaw: '36.90',
      statusRaw: 'Ukończone',
    })
    const b = buildBoltCsvExternalTripId({
      driverUuid: '11111111-1111-1111-1111-111111111111',
      startedAtRaw: '2026-08-15 15:14',
      route: 'ul. Przykładowa 1, Warszawa → ul. Testowa 10, Warszawa',
      revenueRaw: '36.90',
      statusRaw: 'Ukończone',
    })
    expect(a).toBe(b)
    expect(a).toMatch(/^boltcsv:[a-f0-9]{32}$/)

    const first = parseBoltTripHistoryCsv({
      csvText,
      ingestSource: 'platform_csv',
    }).rows[0]!
    expect(first.externalTripId).toBe(a)
  })

  it('rejects files without required portal headers', () => {
    const result = parseBoltTripHistoryCsv({
      csvText: 'externalTripId,platformDriverId,startedAt,revenueAmount\nid,d1,2026-01-01,10\n',
      ingestSource: 'platform_csv',
    })
    expect(result.rows).toEqual([])
    expect(result.errors[0]?.message).toMatch(/missing required columns/i)
  })
})
