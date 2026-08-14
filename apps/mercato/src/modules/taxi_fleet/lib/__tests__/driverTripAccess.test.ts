import { canAccessDriverTrips } from '../../components/driverApp/driverTripAccess'

describe('canAccessDriverTrips', () => {
  it('allows trip UI without clock-in (past trips from earlier shifts)', () => {
    expect(canAccessDriverTrips({ shiftStart: null, bypass: false })).toBe(true)
  })

  it('allows after clock-in even if shift ended', () => {
    expect(canAccessDriverTrips({ shiftStart: '2026-08-08T08:00:00.000Z', bypass: false })).toBe(true)
  })

  it('allows intentional pre-shift bypass', () => {
    expect(canAccessDriverTrips({ shiftStart: null, bypass: true })).toBe(true)
  })
})
