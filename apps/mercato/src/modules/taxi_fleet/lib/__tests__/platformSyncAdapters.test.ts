import { extractVendorTripList, mapVendorTripRecord } from '../platformSync/adapters/mapVendorTrip'
import {
  isPlatformSyncPlatformConfigured,
  listEnabledPlatformSyncPlatforms,
} from '../platformSync/platformSyncCredentials'
import { defaultPlatformSyncSettings } from '../taxiFleetSettings'
import { resolveDefaultPlatformSyncWindow } from '../platformSync/resolvePlatformSyncWindow'

describe('mapVendorTripRecord', () => {
  it('maps bolt-style order payload', () => {
    const mapped = mapVendorTripRecord('bolt', {
      order_id: 'bolt-99',
      driver_uuid: 'driver-1',
      start_time: '2026-08-20T08:00:00Z',
      end_time: '2026-08-20T08:30:00Z',
      price: 42.5,
      payment_type: 'cash',
      status: 'completed',
    })
    expect(mapped).toMatchObject({
      platform: 'bolt',
      externalTripId: 'bolt-99',
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
    platformSync.bolt = {
      enabled: true,
      apiBaseUrl: 'https://fleet.example',
      clientId: 'id',
      clientSecret: 'secret',
      refreshToken: '',
      companyId: 'co-1',
    }
    expect(isPlatformSyncPlatformConfigured(platformSync.bolt)).toBe(true)
    expect(listEnabledPlatformSyncPlatforms(platformSync)).toEqual(['bolt'])
  })
})

describe('resolveDefaultPlatformSyncWindow', () => {
  it('uses 26 hour lookback', () => {
    const now = new Date('2026-08-26T12:00:00Z')
    const window = resolveDefaultPlatformSyncWindow(now)
    expect(window.windowTo.toISOString()).toBe(now.toISOString())
    expect(window.windowFrom.toISOString()).toBe('2026-08-25T10:00:00.000Z')
  })
})
