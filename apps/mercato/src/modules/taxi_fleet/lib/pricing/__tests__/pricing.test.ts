import { calculateQuote, ceilDistanceKm } from '../quote'
import { selectVehicle } from '../vehicle'
import { defaultFleetPricingConfig, resolveFleetPricingConfig } from '../resolveFleetPricingConfig'
import { QuoteValidationError } from '../quote-types'
import { computeBasePrice, roundMoney } from '../surcharges'
import type { PricingConfig } from '../types'

const config = defaultFleetPricingConfig()

/** Tuesday 2026-03-10 — weekday, not Sunday. */
const WEEKDAY = '2026-03-10'
/** Sunday 2026-03-08 */
const SUNDAY = '2026-03-08'

function baseInput(overrides: Partial<Parameters<typeof calculateQuote>[0]> = {}) {
  return {
    serviceType: 'airport' as const,
    passengers: 2,
    handLuggage: 0,
    holdLuggage: 0,
    distanceKm: 10,
    date: WEEKDAY,
    time: '10:00',
    childSeats: 0,
    boosterSeats: 0,
    ...overrides,
  }
}

function withMaxOnePolicy(base: PricingConfig = config): PricingConfig {
  return {
    ...base,
    percentSurcharges: {
      ...base.percentSurcharges,
      policy: 'maxOne',
    },
  }
}

describe('defaultFleetPricingConfig — RS Moto settings', () => {
  it('exposes documented defaults', () => {
    expect(config.passengers).toEqual({ min: 1, max: 8 })
    expect(config.distance.rounding).toBe('ceil')
    expect(config.booking.minAdvanceHours).toBe(24)
    expect(config.percentSurcharges.policy).toBe('stack')
    expect(config.percentSurcharges.priority).toEqual(['NIGHT', 'HOLIDAY'])
    expect(config.currency).toBe('PLN')
    expect(config.rounding.moneyDecimalPlaces).toBe(2)

    const night = config.percentSurcharges.items.find((item) => item.code === 'NIGHT')
    expect(night).toMatchObject({
      rate: 0.2,
      timeRange: { start: '22:00', end: '06:00', endExclusive: true },
    })

    const holiday = config.percentSurcharges.items.find((item) => item.code === 'HOLIDAY')
    expect(holiday).toMatchObject({
      rate: 0.2,
      includesSunday: true,
      includesPublicHolidays: true,
      country: 'PL',
    })

    expect(config.tariffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          serviceType: 'airport',
          vehicleCategory: 'standard',
          minimumFare: 85,
          includedKm: 10,
          ratePerKm: 4,
        }),
        expect.objectContaining({
          serviceType: 'airport',
          vehicleCategory: 'van',
          minimumFare: 120,
          includedKm: 10,
          ratePerKm: 7,
        }),
        expect.objectContaining({
          serviceType: 'local',
          vehicleCategory: 'standard',
          minimumFare: 50,
          includedKm: 5,
          ratePerKm: 4,
        }),
        expect.objectContaining({
          serviceType: 'local',
          vehicleCategory: 'van',
          minimumFare: 70,
          includedKm: 5,
          ratePerKm: 5,
        }),
      ]),
    )
  })

  it('resolveFleetPricingConfig merges org patches over defaults', () => {
    const resolved = resolveFleetPricingConfig({
      pricing: {
        ...config,
        booking: { minAdvanceHours: 48 },
        passengers: { min: 1, max: 6 },
        percentSurcharges: {
          ...config.percentSurcharges,
          policy: 'maxOne',
        },
      },
    })
    expect(resolved.booking.minAdvanceHours).toBe(48)
    expect(resolved.passengers.max).toBe(6)
    expect(resolved.percentSurcharges.policy).toBe('maxOne')
    expect(resolved.tariffs).toEqual(config.tariffs)
  })

  it('resolveFleetPricingConfig returns defaults when pricing patch missing', () => {
    const resolved = resolveFleetPricingConfig({ pricing: undefined as never })
    expect(resolved.booking.minAdvanceHours).toBe(24)
    expect(resolved.percentSurcharges.policy).toBe('stack')
  })
})

describe('distance rounding', () => {
  it('ceils fractional km', () => {
    expect(ceilDistanceKm(10.1)).toBe(11)
    expect(ceilDistanceKm(10.01)).toBe(11)
    expect(ceilDistanceKm(10)).toBe(10)
    expect(ceilDistanceKm(0.1)).toBe(1)
  })

  it('applies ceil before tariff math', () => {
    // 10.1 → 11 km → airport standard: 85 + 1×4 = 89
    const result = calculateQuote(baseInput({ distanceKm: 10.1 }), config)
    expect(result.basePrice).toBe(89)
  })
})

describe('base tariffs', () => {
  it.each([
    {
      name: 'airport standard within included km',
      input: { distanceKm: 8, handLuggage: 2, holdLuggage: 2 },
      basePrice: 85,
      vehicle: 'standard' as const,
    },
    {
      name: 'airport standard exactly included km',
      input: { distanceKm: 10 },
      basePrice: 85,
      vehicle: 'standard' as const,
    },
    {
      name: 'airport standard beyond included km',
      input: { distanceKm: 15 },
      basePrice: 105, // 85 + 5×4
      vehicle: 'standard' as const,
    },
    {
      name: 'airport van within included km',
      input: { passengers: 5, distanceKm: 10 },
      basePrice: 120,
      vehicle: 'van' as const,
    },
    {
      name: 'airport van beyond included km',
      input: { passengers: 5, distanceKm: 12 },
      basePrice: 134, // 120 + 2×7
      vehicle: 'van' as const,
    },
    {
      name: 'local standard within included km',
      input: { serviceType: 'local' as const, distanceKm: 5, holdLuggage: 0 },
      basePrice: 50,
      vehicle: 'standard' as const,
    },
    {
      name: 'local standard beyond included km',
      input: { serviceType: 'local' as const, distanceKm: 8, holdLuggage: 0 },
      basePrice: 62, // 50 + 3×4
      vehicle: 'standard' as const,
    },
    {
      name: 'local van within included km',
      input: { serviceType: 'local' as const, passengers: 5, distanceKm: 5, holdLuggage: 0 },
      basePrice: 70,
      vehicle: 'van' as const,
    },
    {
      name: 'local van beyond included km',
      input: { serviceType: 'local' as const, passengers: 5, distanceKm: 9, holdLuggage: 0 },
      basePrice: 90, // 70 + 4×5
      vehicle: 'van' as const,
    },
  ])('$name', ({ input, basePrice, vehicle }) => {
    const result = calculateQuote(baseInput(input), config)
    expect(result.vehicleCategory).toBe(vehicle)
    expect(result.basePrice).toBe(basePrice)
    expect(result.totalPrice).toBe(basePrice)
  })

  it('computeBasePrice matches tariff formula directly', () => {
    expect(computeBasePrice(config, 'airport', 'standard', 10)).toBe(85)
    expect(computeBasePrice(config, 'airport', 'standard', 11)).toBe(89)
    expect(computeBasePrice(config, 'local', 'van', 6)).toBe(75)
  })
})

describe('vehicle selection — airport', () => {
  it('≤3 pax with luggage within limits → standard', () => {
    expect(selectVehicle(config, 'airport', 1, 1, 1).category).toBe('standard')
    expect(selectVehicle(config, 'airport', 3, 3, 3).category).toBe('standard')
  })

  it('4 pax + zero hold → standard', () => {
    const selected = selectVehicle(config, 'airport', 4, 4, 0)
    expect(selected.category).toBe('standard')
    expect(selected.warnings).toHaveLength(0)
  })

  it('4 pax + hold ≥ 1 → van with warning', () => {
    const selected = selectVehicle(config, 'airport', 4, 0, 1)
    expect(selected.category).toBe('van')
    expect(selected.warnings).toContain('vehicle.fourPassengersVanUpgrade')
  })

  it('≥5 pax → van (no warning)', () => {
    for (const pax of [5, 6, 7, 8]) {
      const selected = selectVehicle(config, 'airport', pax, 0, 0)
      expect(selected.category).toBe('van')
      expect(selected.warnings).toHaveLength(0)
    }
  })

  it('≤3 pax with hold overflow → van with warning', () => {
    const selected = selectVehicle(config, 'airport', 2, 0, 4)
    expect(selected.category).toBe('van')
    expect(selected.warnings).toContain('vehicle.luggageOverflowUpgrade')
  })

  it('≤3 pax with hand overflow → van with warning', () => {
    const selected = selectVehicle(config, 'airport', 3, 4, 0)
    expect(selected.category).toBe('van')
    expect(selected.warnings).toContain('vehicle.luggageOverflowUpgrade')
  })

  it('propagates vehicle warning on quote', () => {
    const result = calculateQuote(baseInput({ passengers: 4, holdLuggage: 1, distanceKm: 10 }), config)
    expect(result.vehicleCategory).toBe('van')
    expect(result.warnings).toContain('vehicle.fourPassengersVanUpgrade')
    expect(result.basePrice).toBe(120)
  })

  it('respects explicit vehicleCategory override', () => {
    const result = calculateQuote(
      baseInput({ passengers: 5, vehicleCategory: 'standard', distanceKm: 10 }),
      config,
    )
    expect(result.vehicleCategory).toBe('standard')
    expect(result.basePrice).toBe(85)
    expect(result.warnings).toBeUndefined()
  })
})

describe('vehicle selection — local', () => {
  it('≤4 pax → standard', () => {
    expect(selectVehicle(config, 'local', 1, 0, 0).category).toBe('standard')
    expect(selectVehicle(config, 'local', 4, 4, 0).category).toBe('standard')
  })

  it('≥5 pax → van with warning', () => {
    const selected = selectVehicle(config, 'local', 5, 0, 0)
    expect(selected.category).toBe('van')
    expect(selected.warnings).toContain('vehicle.passengersVanUpgrade')
  })
})

describe('night surcharge windows', () => {
  it.each([
    { time: '21:59', night: false },
    { time: '22:00', night: true },
    { time: '23:30', night: true },
    { time: '00:00', night: true },
    { time: '03:15', night: true },
    { time: '05:59', night: true },
    { time: '06:00', night: false },
    { time: '06:01', night: false },
    { time: '12:00', night: false },
  ])('time $time → night=$night', ({ time, night }) => {
    const result = calculateQuote(baseInput({ distanceKm: 15, time }), config)
    const hasNight = result.surcharges.some((line) => line.code === 'NIGHT')
    expect(hasNight).toBe(night)
    if (night) {
      expect(result.totalPrice).toBe(126) // 105 + 21
    } else {
      expect(result.totalPrice).toBe(105)
    }
  })
})

describe('holiday surcharge', () => {
  it('sunday daytime → HOLIDAY only', () => {
    const result = calculateQuote(baseInput({ distanceKm: 15, date: SUNDAY, time: '12:00' }), config)
    expect(result.surcharges.map((line) => line.code)).toEqual(['HOLIDAY'])
    expect(result.surcharges[0]?.amount).toBe(21)
    expect(result.totalPrice).toBe(126)
  })

  it('weekday public holiday → HOLIDAY', () => {
    const result = calculateQuote(
      baseInput({ distanceKm: 15, date: WEEKDAY, time: '12:00', isPublicHoliday: true }),
      config,
    )
    expect(result.surcharges.map((line) => line.code)).toEqual(['HOLIDAY'])
    expect(result.totalPrice).toBe(126)
  })

  it('weekday non-holiday daytime → no percent surcharge', () => {
    const result = calculateQuote(
      baseInput({ distanceKm: 15, date: WEEKDAY, time: '12:00', isPublicHoliday: false }),
      config,
    )
    expect(result.surcharges).toHaveLength(0)
    expect(result.totalPrice).toBe(105)
  })
})

describe('percent surcharge policy', () => {
  it('stack: night + sunday → NIGHT + HOLIDAY (+40%)', () => {
    const result = calculateQuote(
      baseInput({ distanceKm: 15, date: SUNDAY, time: '23:00', isPublicHoliday: false }),
      config,
    )
    expect(result.basePrice).toBe(105)
    expect(result.surcharges.map((line) => line.code)).toEqual(['NIGHT', 'HOLIDAY'])
    expect(result.surcharges[0]?.amount).toBe(21)
    expect(result.surcharges[1]?.amount).toBe(21)
    expect(result.totalPrice).toBe(147)
  })

  it('stack: night + public holiday weekday → both', () => {
    const result = calculateQuote(
      baseInput({
        distanceKm: 15,
        date: WEEKDAY,
        time: '00:30',
        isPublicHoliday: true,
      }),
      config,
    )
    expect(result.surcharges.map((line) => line.code)).toEqual(['NIGHT', 'HOLIDAY'])
    expect(result.totalPrice).toBe(147)
  })

  it('maxOne: night + sunday → only NIGHT (priority)', () => {
    const result = calculateQuote(
      baseInput({ distanceKm: 15, date: SUNDAY, time: '23:00' }),
      withMaxOnePolicy(),
    )
    expect(result.surcharges).toHaveLength(1)
    expect(result.surcharges[0]?.code).toBe('NIGHT')
    expect(result.totalPrice).toBe(126)
  })

  it('maxOne: sunday daytime → HOLIDAY', () => {
    const result = calculateQuote(
      baseInput({ distanceKm: 15, date: SUNDAY, time: '12:00' }),
      withMaxOnePolicy(),
    )
    expect(result.surcharges.map((line) => line.code)).toEqual(['HOLIDAY'])
    expect(result.totalPrice).toBe(126)
  })

  it('percent amounts are computed from basePrice only (not stacked on each other)', () => {
    const result = calculateQuote(
      baseInput({ distanceKm: 15, date: SUNDAY, time: '23:00' }),
      config,
    )
    // Each line is 20% of 105, not 20% of 105+21
    expect(result.surcharges.every((line) => line.amount === 21)).toBe(true)
  })
})

describe('fixed surcharges', () => {
  it('MEET_GREET on airport', () => {
    const result = calculateQuote(baseInput({ meetAndGreet: true, distanceKm: 10 }), config)
    expect(result.surcharges).toEqual([
      expect.objectContaining({ code: 'MEET_GREET', amount: 20 }),
    ])
    expect(result.totalPrice).toBe(105)
  })

  it('MEET_GREET ignored for local', () => {
    const result = calculateQuote(
      baseInput({
        serviceType: 'local',
        holdLuggage: 0,
        meetAndGreet: true,
        distanceKm: 5,
      }),
      config,
    )
    expect(result.surcharges.some((line) => line.code === 'MEET_GREET')).toBe(false)
    expect(result.totalPrice).toBe(50)
  })

  it('CHILD_SEAT × quantity', () => {
    const result = calculateQuote(baseInput({ passengers: 3, childSeats: 3, distanceKm: 10 }), config)
    expect(result.surcharges).toEqual([
      expect.objectContaining({ code: 'CHILD_SEAT', amount: 60 }),
    ])
    expect(result.totalPrice).toBe(145)
  })

  it('BOOSTER × quantity', () => {
    const result = calculateQuote(baseInput({ passengers: 2, boosterSeats: 2, distanceKm: 10 }), config)
    expect(result.surcharges).toEqual([
      expect.objectContaining({ code: 'BOOSTER', amount: 20 }),
    ])
    expect(result.totalPrice).toBe(105)
  })

  it('combines meet & greet, child seats, boosters', () => {
    const result = calculateQuote(
      baseInput({
        passengers: 3,
        distanceKm: 10,
        meetAndGreet: true,
        childSeats: 2,
        boosterSeats: 1,
      }),
      config,
    )
    expect(result.basePrice).toBe(85)
    expect(result.surcharges.map((line) => line.code).sort()).toEqual([
      'BOOSTER',
      'CHILD_SEAT',
      'MEET_GREET',
    ])
    expect(result.totalPrice).toBe(85 + 20 + 40 + 10)
  })

  it('zero counts add no fixed lines', () => {
    const result = calculateQuote(
      baseInput({ meetAndGreet: false, childSeats: 0, boosterSeats: 0 }),
      config,
    )
    expect(result.surcharges).toHaveLength(0)
  })
})

describe('calculation order & combined totals', () => {
  it('percent then fixed: night + meet & greet', () => {
    // base 105, NIGHT 21, MEET_GREET 20 → 146
    const result = calculateQuote(
      baseInput({ distanceKm: 15, time: '22:00', meetAndGreet: true }),
      config,
    )
    expect(result.surcharges.map((line) => line.code)).toEqual(['NIGHT', 'MEET_GREET'])
    expect(result.totalPrice).toBe(146)
  })

  it('stack night+holiday + fixed fees', () => {
    // base 105 + 21 + 21 + 20 + 20 + 10 = 197
    const result = calculateQuote(
      baseInput({
        passengers: 2,
        distanceKm: 15,
        date: SUNDAY,
        time: '23:00',
        meetAndGreet: true,
        childSeats: 1,
        boosterSeats: 1,
      }),
      config,
    )
    expect(result.totalPrice).toBe(197)
  })

  it('rounds money to 2 decimal places', () => {
    expect(roundMoney(config, 105.005)).toBe(105.01)
    expect(roundMoney(config, 105.004)).toBe(105)
  })
})

describe('english-speaking driver', () => {
  it('has no price impact', () => {
    const without = calculateQuote(baseInput({ distanceKm: 15, time: '22:00', meetAndGreet: true }), config)
    const withFlag = calculateQuote(
      baseInput({
        distanceKm: 15,
        time: '22:00',
        meetAndGreet: true,
        englishSpeakingDriver: true,
      }),
      config,
    )
    expect(withFlag.totalPrice).toBe(without.totalPrice)
    expect(withFlag.surcharges).toEqual(without.surcharges)
  })
})

describe('input validation', () => {
  it('rejects passengers outside 1–8', () => {
    expect(() => calculateQuote(baseInput({ passengers: 0 }), config)).toThrow(QuoteValidationError)
    expect(() => calculateQuote(baseInput({ passengers: 9 }), config)).toThrow(QuoteValidationError)
    try {
      calculateQuote(baseInput({ passengers: 9 }), config)
    } catch (error) {
      expect(error).toBeInstanceOf(QuoteValidationError)
      expect((error as QuoteValidationError).code).toBe('PASSENGERS_RANGE')
    }
  })

  it('accepts boundary passengers 1 and 8', () => {
    expect(calculateQuote(baseInput({ passengers: 1 }), config).basePrice).toBe(85)
    expect(
      calculateQuote(
        baseInput({ serviceType: 'local', passengers: 8, holdLuggage: 0, distanceKm: 5 }),
        config,
      ).vehicleCategory,
    ).toBe('van')
  })

  it('rejects non-positive distance', () => {
    expect(() => calculateQuote(baseInput({ distanceKm: 0 }), config)).toThrow(QuoteValidationError)
    expect(() => calculateQuote(baseInput({ distanceKm: -1 }), config)).toThrow(QuoteValidationError)
  })

  it('rejects hand luggage above passengers', () => {
    try {
      calculateQuote(baseInput({ passengers: 2, handLuggage: 3 }), config)
      throw new Error('expected throw')
    } catch (error) {
      expect((error as QuoteValidationError).code).toBe('HAND_LUGGAGE_EXCEEDS_PASSENGERS')
    }
  })

  it('rejects hold luggage above passengers', () => {
    try {
      calculateQuote(baseInput({ passengers: 2, holdLuggage: 3 }), config)
      throw new Error('expected throw')
    } catch (error) {
      expect((error as QuoteValidationError).code).toBe('HOLD_LUGGAGE_EXCEEDS_PASSENGERS')
    }
  })

  it('rejects hold luggage on local', () => {
    try {
      calculateQuote(baseInput({ serviceType: 'local', holdLuggage: 1 }), config)
      throw new Error('expected throw')
    } catch (error) {
      expect((error as QuoteValidationError).code).toBe('LOCAL_HOLD_LUGGAGE')
    }
  })

  it('rejects seats exceeding passengers', () => {
    try {
      calculateQuote(baseInput({ passengers: 2, childSeats: 2, boosterSeats: 1 }), config)
      throw new Error('expected throw')
    } catch (error) {
      expect((error as QuoteValidationError).code).toBe('SEATS_EXCEED_PASSENGERS')
    }
  })
})
