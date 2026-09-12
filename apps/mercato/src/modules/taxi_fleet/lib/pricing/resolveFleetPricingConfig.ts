import defaultFleetPricingJson from '../../config/defaultFleetPricing.json'
import type { TaxiFleetSettings } from '../taxiFleetSettings'
import { parsePricingConfig } from './pricingConfigSchema'
import type { PricingConfig } from './types'

function deepMergePricing(base: PricingConfig, patch: Record<string, unknown>): PricingConfig {
  return parsePricingConfig({
    ...base,
    ...patch,
    passengers: { ...base.passengers, ...(patch.passengers as Record<string, unknown> | undefined) },
    distance: { ...base.distance, ...(patch.distance as Record<string, unknown> | undefined) },
    booking: { ...base.booking, ...(patch.booking as Record<string, unknown> | undefined) },
    vehicleSelection: {
      ...base.vehicleSelection,
      ...(patch.vehicleSelection as Record<string, unknown> | undefined),
    },
    percentSurcharges: {
      ...base.percentSurcharges,
      ...(patch.percentSurcharges as Record<string, unknown> | undefined),
    },
    rounding: { ...base.rounding, ...(patch.rounding as Record<string, unknown> | undefined) },
    tariffs: Array.isArray(patch.tariffs) ? patch.tariffs : base.tariffs,
    fixedSurcharges: Array.isArray(patch.fixedSurcharges) ? patch.fixedSurcharges : base.fixedSurcharges,
    calculationOrder: Array.isArray(patch.calculationOrder) ? patch.calculationOrder : base.calculationOrder,
  })
}

export function defaultFleetPricingConfig(): PricingConfig {
  return parsePricingConfig(defaultFleetPricingJson)
}

export function resolveFleetPricingConfig(settings: Pick<TaxiFleetSettings, 'pricing'>): PricingConfig {
  const base = defaultFleetPricingConfig()
  const patch = settings.pricing
  if (!patch || typeof patch !== 'object') return base
  return deepMergePricing(base, patch as Record<string, unknown>)
}
