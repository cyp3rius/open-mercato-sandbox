import type { EntityManager } from '@mikro-orm/postgresql'
import { runFleetQuote } from '../runFleetQuote'
import { defaultFleetPricingConfig } from '../resolveFleetPricingConfig'

jest.mock('../../taxiFleetOrganizationSettings', () => ({
  loadTaxiFleetOrganizationSettings: jest.fn(async () => ({})),
}))

jest.mock('../resolveFleetPricingConfig', () => {
  const actual = jest.requireActual('../resolveFleetPricingConfig') as typeof import('../resolveFleetPricingConfig')
  return {
    ...actual,
    resolveFleetPricingConfig: jest.fn(() => actual.defaultFleetPricingConfig()),
  }
})

jest.mock('../publicHoliday', () => ({
  isPublicHolidayPl: jest.fn(async () => false),
}))

describe('runFleetQuote', () => {
  it('returns currency + quote without forcing client vehicleCategory', async () => {
    const em = {} as EntityManager
    const result = await runFleetQuote(
      em,
      {
        tenantId: '11111111-1111-4111-8111-111111111111',
        organizationId: '22222222-2222-4222-8222-222222222222',
      },
      {
        serviceType: 'local',
        passengers: 6,
        distanceKm: 10,
        date: '2026-03-10',
        time: '10:00',
        handLuggage: 0,
        holdLuggage: 0,
        childSeats: 0,
        boosterSeats: 0,
        meetAndGreet: false,
        englishSpeakingDriver: false,
      },
    )

    expect(result.currency).toBe(defaultFleetPricingConfig().currency)
    expect(result.vehicleCategory).toBe('van')
    expect(result.totalPrice).toBeGreaterThan(0)
    expect(result.basePrice).toBeGreaterThan(0)
  })

  it('honors explicit vehicleCategory override', async () => {
    const em = {} as EntityManager
    const result = await runFleetQuote(
      em,
      {
        tenantId: '11111111-1111-4111-8111-111111111111',
        organizationId: '22222222-2222-4222-8222-222222222222',
      },
      {
        serviceType: 'local',
        passengers: 6,
        distanceKm: 10,
        date: '2026-03-10',
        time: '10:00',
        handLuggage: 0,
        childSeats: 0,
        boosterSeats: 0,
        vehicleCategory: 'standard',
      },
    )

    expect(result.vehicleCategory).toBe('standard')
  })
})
