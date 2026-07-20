export const CATALOG_PRODUCT_TYPES = [
  'simple',
  'configurable',
  'virtual',
  'downloadable',
  'bundle',
  'grouped',
] as const

export type CatalogProductType = (typeof CATALOG_PRODUCT_TYPES)[number]

/** Service-line code that marks a product as a timed subscription offering. */
export const CATALOG_SUBSCRIPTION_SERVICE_LINE_CODE = 'subscription'

export type CatalogProductCaseTemplate = {
  id: string
  title: string
  playbookId?: string | null
  recurrenceEnabled?: boolean
  recurrenceIntervalAmount?: number | null
  recurrenceIntervalUnit?: 'hours' | 'days' | 'weeks' | 'months' | null
  recurrenceCreateLeadTime?: { amount: number; unit: 'hours' | 'days' | 'weeks' | 'months' } | null
}

export const CATALOG_CONFIGURABLE_PRODUCT_TYPES = ['configurable', 'virtual', 'downloadable'] as const

export const CATALOG_SUBPRODUCT_PRODUCT_TYPES = ['bundle', 'grouped'] as const

export type CatalogConfigurableProductType = (typeof CATALOG_CONFIGURABLE_PRODUCT_TYPES)[number]

export const CATALOG_PRODUCT_RELATION_TYPES = ['bundle', 'grouped'] as const

export type CatalogProductRelationType = (typeof CATALOG_PRODUCT_RELATION_TYPES)[number]

export type CatalogProductOptionChoice = {
  code: string
  label?: string | null
}

export type CatalogProductOptionDefinition = {
  code: string
  label: string
  description?: string | null
  inputType: 'select' | 'text' | 'textarea' | 'number'
  isRequired?: boolean
  isMultiple?: boolean
  choices?: CatalogProductOptionChoice[]
}

export type CatalogProductOptionSchema = {
  version?: number
  name?: string | null
  description?: string | null
  options: CatalogProductOptionDefinition[]
}

export type CatalogPricingScope = {
  channelId?: string | null
  offerId?: string | null
  userId?: string | null
  userGroupId?: string | null
  customerId?: string | null
  customerGroupId?: string | null
}

export const CATALOG_PRICE_DISPLAY_MODES = ['including-tax', 'excluding-tax'] as const

export type CatalogPriceDisplayMode = (typeof CATALOG_PRICE_DISPLAY_MODES)[number]
