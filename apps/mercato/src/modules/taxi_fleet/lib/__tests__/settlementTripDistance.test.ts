import {
  buildSettlementDistanceFromTrips,
  isTripDistanceMissing,
  parseTripDistanceKm,
  tripBelongsToSettlementWeek,
} from '../settlementTripDistance'

describe('settlementTripDistance', () => {
  describe('parseTripDistanceKm', () => {
    it('parses positive numeric strings', () => {
      expect(parseTripDistanceKm('12.5')).toBe(12.5)
    })

    it('treats zero, empty, and invalid as missing', () => {
      expect(parseTripDistanceKm('0')).toBeNull()
      expect(parseTripDistanceKm('')).toBeNull()
      expect(parseTripDistanceKm(null)).toBeNull()
      expect(parseTripDistanceKm('abc')).toBeNull()
    })
  })

  describe('isTripDistanceMissing', () => {
    it('flags missing values', () => {
      expect(isTripDistanceMissing(null)).toBe(true)
      expect(isTripDistanceMissing('15')).toBe(false)
    })
  })

  describe('tripBelongsToSettlementWeek', () => {
    it('includes trips in week and excludes cancelled', () => {
      expect(
        tripBelongsToSettlementWeek(
          { startedAt: new Date('2026-08-11T10:00:00.000Z'), status: 'completed' },
          '2026-08-10',
        ),
      ).toBe(true)
      expect(
        tripBelongsToSettlementWeek(
          { startedAt: new Date('2026-08-11T10:00:00.000Z'), status: 'cancelled' },
          '2026-08-10',
        ),
      ).toBe(false)
      expect(
        tripBelongsToSettlementWeek(
          { endedAt: new Date('2026-08-09T10:00:00.000Z'), status: 'completed' },
          '2026-08-10',
        ),
      ).toBe(false)
    })
  })

  describe('buildSettlementDistanceFromTrips', () => {
    it('sums known distances and tracks missing trips', () => {
      const result = buildSettlementDistanceFromTrips([
        {
          id: 't1',
          startedAt: new Date('2026-08-11T10:00:00.000Z'),
          endedAt: null,
          status: 'completed',
          tripType: 'client',
          distanceKm: '10',
        },
        {
          id: 't2',
          startedAt: new Date('2026-08-12T10:00:00.000Z'),
          endedAt: null,
          status: 'completed',
          tripType: 'client',
          distanceKm: '5.25',
        },
        {
          id: 't3',
          startedAt: new Date('2026-08-13T10:00:00.000Z'),
          endedAt: null,
          status: 'completed',
          tripType: 'private',
          distanceKm: null,
        },
      ])

      expect(result.computedDistanceKm).toBe(15.25)
      expect(result.missingDistanceTripIds).toEqual(['t3'])
      expect(result.trips).toHaveLength(3)
      expect(result.trips.find((trip) => trip.id === 't3')?.missingDistance).toBe(true)
    })
  })
})
