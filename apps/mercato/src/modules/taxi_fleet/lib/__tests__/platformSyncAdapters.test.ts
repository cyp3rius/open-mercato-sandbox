import { extractVendorTripList, mapVendorTripRecord } from '../platformSync/adapters/mapVendorTrip'
import {
  isPlatformSyncPlatformConfigured,
  listEnabledPlatformSyncPlatforms,
} from '../platformSync/platformSyncCredentials'
import { defaultPlatformSyncSettings } from '../taxiFleetSettings'
import {
  resolveManualPlatformSyncWindow,
  resolveScheduledPlatformSyncWindow,
} from '../platformSync/resolvePlatformSyncWindow'

describe('mapVendorTripRecord', () => {
  it('maps bolt-style order payload', () => {
    const mapped = mapVendorTripRecord('bolt', {
      order_reference: 'bolt-ref-99',
      driver_uuid: 'driver-1',
      start_time: '2026-08-20T08:00:00Z',
      end_time: '2026-08-20T08:30:00Z',
      price: 42.5,
      payment_type: 'cash',
      status: 'completed',
    })
    expect(mapped).toMatchObject({
      platform: 'bolt',
      externalTripId: 'bolt-ref-99',
      platformDriverId: 'driver-1',
      paymentType: 'cash',
      revenueAmount: 42.5,
    })
  })

  it('extracts trips array from wrapped payload', () => {
    const rows = extractVendorTripList({
      data: [{ id: 'trip-1', driver_id: 'd1', started_at: '2026-01-01T10:00:00Z', revenue_amount: 10 }],
    })
    expect(rows).toHaveLength(1)
  })
})

describe('platformSyncCredentials', () => {
  it('lists only enabled platforms with api base and secret', () => {
    const platformSync = defaultPlatformSyncSettings()
    platformSync.uber = {
      enabled: true,
      apiBaseUrl: 'https://fleet.example',
      clientId: 'id',
      clientSecret: 'secret',
      refreshToken: '',
      companyId: 'co-1',
    }
    expect(isPlatformSyncPlatformConfigured(platformSync.uber, 'uber')).toBe(true)
    expect(listEnabledPlatformSyncPlatforms(platformSync)).toEqual(['uber'])
  })
})

describe('resolvePlatformSyncWindow', () => {
  it('manual sync uses 7 day lookback', () => {
    const now = new Date('2026-08-26T12:00:00.000Z')
    const window = resolveManualPlatformSyncWindow(now)
    expect(window.windowTo.toISOString()).toBe(now.toISOString())
    expect(window.windowFrom.toISOString()).toBe('2026-08-19T12:00:00.000Z')
  })

  it('scheduled sync continues from last successful fetch end', () => {
    const now = new Date('2026-08-26T12:00:00.000Z')
    const lastEnd = new Date('2026-08-26T11:00:00.000Z')
    const window = resolveScheduledPlatformSyncWindow(lastEnd, now)
    expect(window.windowFrom).toEqual(lastEnd)
    expect(window.windowTo).toEqual(now)
  })

  it('scheduled sync falls back to one hour when no prior success', () => {
    const now = new Date('2026-08-26T12:00:00.000Z')
    const window = resolveScheduledPlatformSyncWindow(null, now)
    expect(window.windowTo.toISOString()).toBe(now.toISOString())
    expect(window.windowFrom.toISOString()).toBe('2026-08-26T11:00:00.000Z')
  })
})
