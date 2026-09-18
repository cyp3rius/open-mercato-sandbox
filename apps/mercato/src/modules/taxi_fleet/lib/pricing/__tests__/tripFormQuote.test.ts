import { calculateQuote } from '../quote'
import { defaultFleetPricingConfig } from '../resolveFleetPricingConfig'
import {
  buildDriverQuoteInputFromRoute,
  buildQuoteInputFromTripForm,
  splitTripScheduleLocal,
} from '../tripFormQuote'
import { FLEET_QUOTE_ACCESS_FEATURES } from '../runFleetQuote'
import type { TripFormValues } from '../../../components/tripFormConfig'

const config = defaultFleetPricingConfig()

/** Sunday 2026-03-08 */
const SUNDAY = '2026-03-08'
/** Saturday 2026-03-07 — no HOLIDAY surcharge */
const SATURDAY = '2026-03-07'
/** Tuesday 2026-03-10 */
const WEEKDAY = '2026-03-10'

function formValues(overrides: Partial<TripFormValues> = {}): TripFormValues {
  return {
    teamMemberId: '',
    resourceId: '',
    customerEntityId: '',
    orderingPersonId: '',
    tripType: 'client',
    platform: '',
    startedAtLocal: `${WEEKDAY}T10:00`,
    endedAtLocal: `${WEEKDAY}T11:00`,
    revenueAmount: '',
    notes: '',
    status: 'scheduled',
    fromLon: '',
    fromLat: '',
    toLon: '',
    toLat: '',
    routeWaypointMeta: '',
    quoteSnapshotJson: '',
    discountJson: '',
    routeDurationSeconds: '',
    routeSyncedFingerprint: '',
    endedAtManual: '0',
    receiptDocumentNumber: '',
    receiptAttachmentId: '',
    serviceType: 'airport',
    fromAddress: 'A',
    toAddress: 'B',
    waypointAddresses: '',
    distanceKm: '15',
    durationText: '',
    passengers: '2',
    handLuggage: '0',
    holdLuggage: '0',
    childSeats: '0',
    boosterSeats: '0',
    isAirportPickup: false,
    flightNumber: '',
    meetAndGreet: false,
    englishSpeakingDriver: false,
    paymentType: 'cash',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    contactType: 'private',
    companyName: '',
    companyTaxId: '',
    vehicleCategory: '',
    basePrice: '',
    referringPartnerEntityId: '',
    ...overrides,
  }
}

describe('splitTripScheduleLocal', () => {
  it('parses datetime-local without UTC conversion', () => {
    expect(splitTripScheduleLocal(`${SUNDAY}T23:00`)).toEqual({ date: SUNDAY, time: '23:00' })
    expect(splitTripScheduleLocal(`${WEEKDAY}T22:00:00`)).toEqual({ date: WEEKDAY, time: '22:00' })
  })

  it('fallback uses local calendar fields (not toISOString date)', () => {
    const local = new Date(2026, 2, 8, 1, 30, 0) // Sunday 01:30 local
    const schedule = splitTripScheduleLocal(local.toString())
    expect(schedule).not.toBeNull()
    expect(schedule!.date).toBe(SUNDAY)
    expect(schedule!.time).toBe('01:30')
  })
})

describe('buildQuoteInputFromTripForm', () => {
  it('omits vehicleCategory so selectVehicle always runs', () => {
    const input = buildQuoteInputFromTripForm(
      formValues({ vehicleCategory: 'standard', passengers: '6', distanceKm: '10' }),
    )
    expect(input).not.toBeNull()
    expect(input!.vehicleCategory).toBeUndefined()
    const quote = calculateQuote(input!, config)
    expect(quote.vehicleCategory).toBe('van')
    expect(quote.basePrice).toBe(120)
  })

  it('night Sunday → NIGHT + HOLIDAY stack', () => {
    const input = buildQuoteInputFromTripForm(
      formValues({ startedAtLocal: `${SUNDAY}T23:00`, distanceKm: '15' }),
    )
    expect(input).toMatchObject({ date: SUNDAY, time: '23:00' })
    const quote = calculateQuote(input!, config)
    expect(quote.surcharges.map((line) => line.code)).toEqual(['NIGHT', 'HOLIDAY'])
    expect(quote.totalPrice).toBe(147)
  })

  it('Saturday daytime → no HOLIDAY', () => {
    const input = buildQuoteInputFromTripForm(
      formValues({ startedAtLocal: `${SATURDAY}T12:00`, distanceKm: '15' }),
    )
    const quote = calculateQuote(input!, config)
    expect(quote.surcharges.some((line) => line.code === 'HOLIDAY')).toBe(false)
    expect(quote.totalPrice).toBe(105)
  })

  it.each([
    { time: '21:59', night: false },
    { time: '22:00', night: true },
    { time: '05:59', night: true },
    { time: '06:00', night: false },
  ])('night boundary $time → night=$night', ({ time, night }) => {
    const input = buildQuoteInputFromTripForm(
      formValues({ startedAtLocal: `${WEEKDAY}T${time}`, distanceKm: '15' }),
    )
    const quote = calculateQuote(input!, config)
    expect(quote.surcharges.some((line) => line.code === 'NIGHT')).toBe(night)
  })
})

describe('buildDriverQuoteInputFromRoute', () => {
  it('applies local / 1 pax / no luggage defaults', () => {
    const input = buildDriverQuoteInputFromRoute({
      startedAtLocal: `${WEEKDAY}T10:00`,
      distanceKm: '12.5',
    })
    expect(input).toEqual({
      serviceType: 'local',
      passengers: 1,
      distanceKm: 12.5,
      date: WEEKDAY,
      time: '10:00',
      handLuggage: 0,
      holdLuggage: 0,
      childSeats: 0,
      boosterSeats: 0,
      meetAndGreet: false,
      englishSpeakingDriver: false,
    })
  })

  it('night Sunday → NIGHT + HOLIDAY with driver defaults', () => {
    const input = buildDriverQuoteInputFromRoute({
      startedAtLocal: `${SUNDAY}T23:00`,
      distanceKm: '15',
    })
    expect(input).not.toBeNull()
    const quote = calculateQuote(input!, config)
    expect(quote.surcharges.map((line) => line.code)).toEqual(['NIGHT', 'HOLIDAY'])
    expect(quote.totalPrice).toBeGreaterThan(quote.basePrice)
  })
})

describe('FLEET_QUOTE_ACCESS_FEATURES', () => {
  it('lists pricing.quote | view | driver | trips.inject', () => {
    expect([...FLEET_QUOTE_ACCESS_FEATURES]).toEqual([
      'taxi_fleet.pricing.quote',
      'taxi_fleet.view',
      'taxi_fleet.driver',
      'taxi_fleet.trips.inject',
    ])
  })
})
