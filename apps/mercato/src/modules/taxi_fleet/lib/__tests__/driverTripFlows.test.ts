import { endsDistanceKm, haversineKm, trackDistanceKm } from '../driverOffline/tripTypes'
import { buildDriverTripPayload } from '../driverOffline/buildTripPayload'
import { resolveDriverTripUpdateInput } from '../driverTripExecution'
import { isDriverTripElectronicallyPrepaid } from '../driverTripPayment'

describe('driver trip geo helpers', () => {
  it('computes haversine distance between two points', () => {
    const km = haversineKm({ lat: 52.2297, lon: 21.0122 }, { lat: 52.1657, lon: 20.9671 })
    expect(km).toBeGreaterThan(5)
    expect(km).toBeLessThan(12)
  })

  it('sums track distance', () => {
    const km = trackDistanceKm([
      { lat: 52.23, lon: 21.01, recordedAt: '2026-08-11T10:00:00.000Z' },
      { lat: 52.22, lon: 21.0, recordedAt: '2026-08-11T10:05:00.000Z' },
      { lat: 52.21, lon: 20.99, recordedAt: '2026-08-11T10:10:00.000Z' },
    ])
    expect(km).not.toBeNull()
    expect(km as number).toBeGreaterThan(0)
  })

  it('returns null ends distance without coordinates', () => {
    expect(endsDistanceKm({ address: 'A' }, { address: 'B' })).toBeNull()
  })
})

describe('buildDriverTripPayload', () => {
  it('includes route metadata and completed status', () => {
    const payload = buildDriverTripPayload({
      route: {
        from: { address: 'Warszawa Centrum', lat: 52.23, lon: 21.01 },
        to: { address: 'Lotnisko', lat: 52.16, lon: 20.96 },
        waypoints: [{ address: 'Mokotow', lat: 52.2, lon: 21.0 }],
        startedAt: '2026-08-11T08:00:00.000Z',
        endedAt: '2026-08-11T08:40:00.000Z',
        distanceKm: 12.5,
        durationText: '40 min',
      },
      commercial: {
        tripType: 'private',
        customerEntityId: '',
        customerLabel: '',
        revenueAmount: '40.00',
        receiptDocumentNumber: '',
        receiptAttachmentId: null,
        receiptAttachmentName: null,
        receiptBlobId: null,
        notes: 'seed',
      },
      resourceId: 'a02aa24d-6e83-400c-ae8c-16155a8c019a',
      status: 'completed',
    })
    expect(payload.status).toBe('completed')
    expect(payload.distanceKm).toBe(12.5)
    expect(payload.endedAt).toBe('2026-08-11T08:40:00.000Z')
    const metadata = payload.metadata as { tripRequest?: { fromAddress?: string; waypointAddresses?: string } }
    expect(metadata.tripRequest?.fromAddress).toBe('Warszawa Centrum')
    expect(metadata.tripRequest?.waypointAddresses).toContain('Mokotow')
  })
})

describe('resolveDriverTripUpdateInput', () => {
  it('allows price and distance edits on scheduled trips', () => {
    const resolved = resolveDriverTripUpdateInput('scheduled', {
      id: '94f1f812-4fc7-4f5a-a30d-314d95a73681',
      revenueAmount: 55,
      distanceKm: 12.4,
    })
    expect(resolved.action).toBe('pricing')
    expect(resolved.input).toEqual({
      id: '94f1f812-4fc7-4f5a-a30d-314d95a73681',
      revenueAmount: 55,
      distanceKm: 12.4,
    })
  })

  it('starts scheduled trip with startedAt only', () => {
    const resolved = resolveDriverTripUpdateInput('scheduled', {
      id: '94f1f812-4fc7-4f5a-a30d-314d95a73681',
      startedAt: '2026-08-11T10:00:00.000Z',
      status: 'in_progress',
    })
    expect(resolved.action).toBe('start')
    expect(resolved.input.status).toBe('in_progress')
    expect(resolved.input.startedAt).toBe('2026-08-11T10:00:00.000Z')
  })

  it('rejects unrelated field changes on scheduled trips', () => {
    expect(() =>
      resolveDriverTripUpdateInput('scheduled', {
        id: '94f1f812-4fc7-4f5a-a30d-314d95a73681',
        notes: 'nope',
      }),
    ).toThrow()
  })

  it('completes in-progress trip with endedAt only', () => {
    const resolved = resolveDriverTripUpdateInput('in_progress', {
      id: '94f1f812-4fc7-4f5a-a30d-314d95a73681',
      endedAt: '2026-08-11T11:00:00.000Z',
      status: 'completed',
    })
    expect(resolved.action).toBe('complete')
    expect(resolved.input).toEqual({
      id: '94f1f812-4fc7-4f5a-a30d-314d95a73681',
      endedAt: '2026-08-11T11:00:00.000Z',
      status: 'completed',
    })
  })
})

describe('isDriverTripElectronicallyPrepaid', () => {
  it('detects electronic payment type as prepaid', () => {
    expect(
      isDriverTripElectronicallyPrepaid({
        status: 'scheduled',
        metadata: { tripRequest: { paymentType: 'electronic' } },
      }),
    ).toBe(true)
  })

  it('detects paypal mark_paid markers', () => {
    expect(
      isDriverTripElectronicallyPrepaid({
        status: 'scheduled',
        metadata: { paymentMethod: 'paypal', paidAt: '2026-08-11T10:00:00.000Z' },
      }),
    ).toBe(true)
  })

  it('keeps cash trips as collectible', () => {
    expect(
      isDriverTripElectronicallyPrepaid({
        status: 'scheduled',
        metadata: { tripRequest: { paymentType: 'cash' } },
      }),
    ).toBe(false)
  })
})
