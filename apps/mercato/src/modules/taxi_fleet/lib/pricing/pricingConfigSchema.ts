import { z } from 'zod'
import type { PricingConfig } from './types'

const tariffSchema = z.object({
  serviceType: z.enum(['airport', 'local']),
  vehicleCategory: z.enum(['standard', 'van']),
  minimumFare: z.number(),
  includedKm: z.number(),
  ratePerKm: z.number(),
})

export const pricingConfigSchema = z
  .object({
    version: z.string(),
    currency: z.string().min(3).max(3),
    passengers: z.object({
      min: z.number().int().min(1),
      max: z.number().int().min(1),
    }),
    distance: z.object({
      rounding: z.literal('ceil'),
    }),
    vehicleSelection: z.record(z.string(), z.unknown()),
    tariffs: z.array(tariffSchema).min(1),
    booking: z
      .object({
        minAdvanceHours: z.number().int().min(0).max(168),
      })
      .optional()
      .default({ minAdvanceHours: 24 }),
    percentSurcharges: z.object({
      policy: z.enum(['maxOne', 'stack']),
      priority: z.array(z.enum(['NIGHT', 'HOLIDAY'])),
      items: z.array(z.record(z.string(), z.unknown())),
    }),
    fixedSurcharges: z.array(z.record(z.string(), z.unknown())),
    calculationOrder: z.array(z.enum(['basePrice', 'percentSurcharges', 'fixedSurcharges'])),
    rounding: z.object({
      moneyDecimalPlaces: z.number().int().min(0).max(4),
    }),
  })
  .passthrough()

export function parsePricingConfig(raw: unknown): PricingConfig {
  return pricingConfigSchema.parse(raw) as unknown as PricingConfig
}
