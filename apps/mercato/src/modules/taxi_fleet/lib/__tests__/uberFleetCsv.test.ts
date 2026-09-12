import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { filterPlatformTripRowsForKnownDrivers } from '../platformSync/resolvePlatformDriver'
import { parseUberFleetCsv } from '../platformSync/parseUberFleetCsv'

const fixturesDir = join(__dirname, '../platformSync/fixtures')

describe('parseUberFleetCsv', () => {
  it('joins trip activity with payments and maps cash/revenue', () => {
    const tripActivityCsvText = readFileSync(
      join(fixturesDir, 'sample-uber-trip-activity.csv'),
      'utf8',
    )
    const paymentsCsvText = readFileSync(join(fixturesDir, 'sample-uber-payments.csv'), 'utf8')
    const result = parseUberFleetCsv({
      tripActivityCsvText,
      paymentsCsvText,
      ingestSource: 'platform_csv',
    })

    expect(result.rows).toHaveLength(2)
    expect(result.errors.some((error) => error.message.includes('No matching payment'))).toBe(true)

    const first = result.rows.find((row) => row.externalTripId === 'trip-uber-001')
    expect(first?.revenueAmount).toBe(18.72)
    expect(first?.paymentType).toBe('electronic')
    expect(first?.platform).toBe('uber')
    expect(first?.fromAddress).toBe('ul. Marszałkowska 1 Warszawa')
    expect(first?.toAddress).toBe('ul. Puławska 10 Warszawa')
    expect(first?.platformVehicleId).toBe('veh-uber-100')
    expect(first?.vehiclePlate).toBe('WX 12345')

    const second = result.rows.find((row) => row.externalTripId === 'trip-uber-002')
    expect(second?.revenueAmount).toBe(42)
    expect(second?.paymentType).toBe('cash')
    expect(second?.fromAddress).toBe('Lotnisko Chopina')
  })

  it('maps English address and vehicle headers', () => {
    const result = parseUberFleetCsv({
      tripActivityCsvText: [
        'Trip UUID,Driver UUID,Trip request time,Dropoff time,Trip distance,Trip status,Pickup address,Dropoff address,Vehicle UUID,License plate',
        'trip-en-1,driver-1,2026-08-24 08:00:00,2026-08-24 08:10:00,2.0,completed,A Street,B Street,veh-9,KR 11AA',
      ].join('\n'),
      paymentsCsvText: [
        'Trip UUID,Driver UUID,Description,Paid to you : Your earnings,Paid to you : Trip balance : Payouts : Cash collected',
        'trip-en-1,driver-1,Trip completed order,10.00,0',
      ].join('\n'),
      ingestSource: 'platform_csv',
    })
    expect(result.errors).toEqual([])
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.fromAddress).toBe('A Street')
    expect(result.rows[0]?.toAddress).toBe('B Street')
    expect(result.rows[0]?.platformVehicleId).toBe('veh-9')
    expect(result.rows[0]?.vehiclePlate).toBe('KR 11AA')
  })

  it('rejects missing Trip Activity columns', () => {
    const result = parseUberFleetCsv({
      tripActivityCsvText: 'foo,bar\n1,2',
      paymentsCsvText: readFileSync(join(fixturesDir, 'sample-uber-payments.csv'), 'utf8'),
      ingestSource: 'platform_csv',
    })
    expect(result.rows).toEqual([])
    expect(result.errors[0]?.message).toContain('Trip Activity CSV missing required columns')
  })

  it('only keeps trips whose Driver UUID matches a CRM uberDriverId', () => {
    const tripActivityCsvText = readFileSync(
      join(fixturesDir, 'sample-uber-trip-activity.csv'),
      'utf8',
    )
    const paymentsCsvText = readFileSync(join(fixturesDir, 'sample-uber-payments.csv'), 'utf8')
    const parsed = parseUberFleetCsv({
      tripActivityCsvText,
      paymentsCsvText,
      ingestSource: 'platform_csv',
    })

    const mapped = filterPlatformTripRowsForKnownDrivers(parsed.rows, new Set(['driver-uber-42']))
    expect(mapped.rows.map((row) => row.externalTripId).sort()).toEqual(['trip-uber-001', 'trip-uber-002'])
    expect(mapped.skippedCount).toBe(0)

    const unmapped = filterPlatformTripRowsForKnownDrivers(parsed.rows, new Set())
    expect(unmapped.rows).toEqual([])
    expect(unmapped.skippedCount).toBe(parsed.rows.length)
  })
})
