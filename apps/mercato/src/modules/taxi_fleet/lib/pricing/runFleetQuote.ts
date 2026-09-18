import type { EntityManager } from '@mikro-orm/postgresql'
import type { QuoteBodyInput } from '../../data/validators'
import { loadTaxiFleetOrganizationSettings } from '../taxiFleetOrganizationSettings'
import { calculateQuote } from './quote'
import { isPublicHolidayPl } from './publicHoliday'
import { resolveFleetPricingConfig } from './resolveFleetPricingConfig'
import type { QuoteResult } from './quote-types'

export const FLEET_QUOTE_ACCESS_FEATURES = [
  'taxi_fleet.pricing.quote',
  'taxi_fleet.view',
  'taxi_fleet.driver',
  'taxi_fleet.trips.inject',
] as const

export type FleetQuoteResponse = QuoteResult & {
  currency: string
}

/**
 * Canonical fleet trip quote: org pricing settings + holiday lookup + calculateQuote.
 * Does not force vehicleCategory — callers that omit it get selectVehicle (RS Moto calculator parity).
 */
export async function runFleetQuote(
  em: EntityManager,
  scope: { tenantId: string; organizationId: string },
  body: QuoteBodyInput,
): Promise<FleetQuoteResponse> {
  const settings = await loadTaxiFleetOrganizationSettings(em, {
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
  })
  const pricingConfig = resolveFleetPricingConfig(settings)

  let isPublicHoliday = body.isPublicHoliday
  if (isPublicHoliday === undefined) {
    isPublicHoliday = await isPublicHolidayPl(body.date)
  }

  const quote = calculateQuote(
    {
      serviceType: body.serviceType,
      passengers: body.passengers,
      distanceKm: body.distanceKm,
      date: body.date,
      time: body.time,
      handLuggage: body.handLuggage,
      holdLuggage: body.holdLuggage,
      childSeats: body.childSeats,
      boosterSeats: body.boosterSeats,
      meetAndGreet: body.meetAndGreet,
      englishSpeakingDriver: body.englishSpeakingDriver,
      isPublicHoliday,
      ...(body.vehicleCategory ? { vehicleCategory: body.vehicleCategory } : {}),
    },
    pricingConfig,
  )

  return {
    currency: pricingConfig.currency,
    ...quote,
  }
}
