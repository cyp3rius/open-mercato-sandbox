import { z } from 'zod'

export const protectionCatalogFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  propertyKey: z.string(),
  type: z.enum(['text', 'number', 'currency', 'checkbox']),
  required: z.boolean().optional(),
})

export const protectionAdditionalOptionSchema = z.object({
  value: z.string(),
  name: z.string(),
})

export const protectionCatalogEntrySchema = z.object({
  value: z.string(),
  label: z.string(),
  description: z.string(),
  /** Lucide icon component name (PascalCase), e.g. Shield, Car */
  icon: z.string().optional(),
  mapsToCoverageKey: z.string().optional(),
  additionalOptionsLabel: z.string().optional(),
  additionalOptions: z.array(protectionAdditionalOptionSchema),
  fields: z.array(protectionCatalogFieldSchema),
})

export const protectionCatalogSchema = z.object({
  options: z.array(protectionCatalogEntrySchema),
})

export type ProtectionCatalogField = z.infer<typeof protectionCatalogFieldSchema>
export type ProtectionCatalogEntry = z.infer<typeof protectionCatalogEntrySchema>
export type ProtectionCatalog = z.infer<typeof protectionCatalogSchema>

export const PROTECTION_CATALOG_CONFIG_MODULE = 'insurance' as const
export const PROTECTION_CATALOG_CONFIG_NAME = 'protection_catalog' as const

export const DEFAULT_PROTECTION_CATALOG: ProtectionCatalog = {
  options: [
    {
      value: 'OC',
      label: 'OC',
      description: 'Obowiązkowe ubezpieczenie odpowiedzialności cywilnej',
      mapsToCoverageKey: 'OC',
      additionalOptions: [],
      fields: [],
    },
    {
      value: 'AC',
      label: 'AC',
      description: 'Ochrona od uszkodzeń, kradzieży i zdarzeń losowych',
      mapsToCoverageKey: 'AC',
      additionalOptions: [],
      fields: [],
    },
    {
      value: 'ASSISTANCE',
      label: 'Assistance',
      description: 'Pomoc drogowa premium 24/7 w Polsce i Europie',
      mapsToCoverageKey: 'ASSISTANCE',
      additionalOptions: [],
      fields: [],
    },
    {
      value: 'NNW',
      label: 'NNW',
      description: 'Następstwa nieszczęśliwych wypadków kierowcy i pasażerów',
      mapsToCoverageKey: 'NNW',
      additionalOptions: [],
      fields: [],
    },
    {
      value: 'GLASS',
      label: 'Ochrona szyb',
      description: 'Naprawa lub wymiana szyb bez utraty zniżek',
      mapsToCoverageKey: 'GLASS',
      additionalOptionsLabel: 'Rodzaj części',
      additionalOptions: [
        { value: 'ORIGINAL', name: 'Oryginały' },
        { value: 'AFTERMARKET', name: 'Zamienniki' },
      ],
      fields: [],
    },
    {
      value: 'DISCOUNT',
      label: 'Ochrona zniżek',
      description: 'Zachowaj wypracowane zniżki po szkodzie',
      mapsToCoverageKey: 'DISCOUNT',
      additionalOptions: [],
      fields: [],
    },
    {
      value: 'FOIL',
      label: 'Ubezpieczenie folii',
      description: 'Ochrona folii ochronnej i przyciemniającej na pojeździe',
      mapsToCoverageKey: 'FOIL',
      additionalOptions: [],
      fields: [],
    },
  ],
}

export function parseProtectionCatalog(raw: unknown): ProtectionCatalog {
  const parsed = protectionCatalogSchema.safeParse(raw)
  if (parsed.success) return parsed.data
  return DEFAULT_PROTECTION_CATALOG
}

export function mergeWithDefaultCatalog(raw: unknown): ProtectionCatalog {
  const parsed = parseProtectionCatalog(raw)
  if (parsed.options.length === 0) return DEFAULT_PROTECTION_CATALOG
  return parsed
}
