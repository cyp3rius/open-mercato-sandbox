import type { PricingConfig } from './types'
import { selectVehicle } from './vehicle'
import { validateQuoteInput } from './validate'
import {
  computeBasePrice,
  computeFixedSurcharges,
  computePercentSurcharges,
  roundMoney,
} from './surcharges'
import type { QuoteInput, QuoteResult } from './quote-types'

export function ceilDistanceKm(km: number): number {
  return Math.ceil(km)
}

export function calculateQuote(input: QuoteInput, config: PricingConfig): QuoteResult {
  validateQuoteInput(input, config)

  const distanceKm = ceilDistanceKm(input.distanceKm)
  const holdLuggage = input.holdLuggage ?? 0
  const selected =
    input.vehicleCategory === 'standard' || input.vehicleCategory === 'van'
      ? { category: input.vehicleCategory, warnings: [] as string[] }
      : selectVehicle(
          config,
          input.serviceType,
          input.passengers,
          input.handLuggage,
          holdLuggage,
        )
  const { category, warnings: warningKeys } = selected

  const basePrice = computeBasePrice(config, input.serviceType, category, distanceKm)

  const percentLines = computePercentSurcharges(config, input, basePrice)
  const fixedLines = computeFixedSurcharges(config, input)
  const surcharges = [...percentLines, ...fixedLines]

  const totalPrice = roundMoney(
    config,
    basePrice + surcharges.reduce((sum, surcharge) => sum + surcharge.amount, 0),
  )

  const warnings = warningKeys.filter(Boolean)

  return {
    vehicleCategory: category,
    basePrice,
    surcharges,
    totalPrice,
    ...(warnings.length > 0 ? { warnings } : {}),
  }
}
