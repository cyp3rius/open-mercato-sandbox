import { z } from 'zod'
import { tripStatusDictionarySchema, defaultTripStatusDictionary, mergeTripStatusDictionary } from './tripStatuses'
import { defaultFleetPricingConfig } from './pricing/resolveFleetPricingConfig'
import { pricingConfigSchema } from './pricing/pricingConfigSchema'
import type { PricingConfig } from './pricing/types'

export const TAXI_FLEET_CUSTOMER_EMAIL_EVENTS = [
  'trip_created',
  'trip_approved',
  'trip_paid',
  'trip_cancelled',
] as const

export type TaxiFleetCustomerEmailEvent = (typeof TAXI_FLEET_CUSTOMER_EMAIL_EVENTS)[number]

export const localizedCustomerEmailTemplateSchema = z.object({
  enabled: z.boolean().default(true),
  subjectPl: z.string().max(500).optional().default(''),
  subjectEn: z.string().max(500).optional().default(''),
  preheaderPl: z.string().max(500).optional().default(''),
  preheaderEn: z.string().max(500).optional().default(''),
  headingPl: z.string().max(500).optional().default(''),
  headingEn: z.string().max(500).optional().default(''),
  introPl: z.string().max(5000).optional().default(''),
  introEn: z.string().max(5000).optional().default(''),
  footerNotePl: z.string().max(2000).optional().default(''),
  footerNoteEn: z.string().max(2000).optional().default(''),
})

export type LocalizedCustomerEmailTemplate = z.infer<typeof localizedCustomerEmailTemplateSchema>

export const taxiFleetPaypalSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  clientId: z.string().max(500).optional().default(''),
  clientSecret: z.string().max(500).optional().default(''),
  mode: z.enum(['sandbox', 'live']).default('sandbox'),
  currency: z.string().min(3).max(3).default('PLN'),
  confirmationPageBase: z.string().max(2000).optional().default(''),
  paymentCancelUrl: z.string().max(2000).optional().default(''),
})

export type TaxiFleetPaypalSettings = z.infer<typeof taxiFleetPaypalSettingsSchema>

export const taxiFleetCalendarSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  calendarId: z.string().max(500).optional().default('primary'),
  timezone: z.string().max(120).default('Europe/Warsaw'),
  serviceAccountEmail: z.string().max(500).optional().default(''),
  serviceAccountPrivateKey: z.string().max(20000).optional().default(''),
  defaultDurationMinutes: z.coerce.number().int().min(15).max(1440).default(60),
})

export type TaxiFleetCalendarSettings = z.infer<typeof taxiFleetCalendarSettingsSchema>

const customerEmailsSchema = z.object({
  trip_created: localizedCustomerEmailTemplateSchema,
  trip_approved: localizedCustomerEmailTemplateSchema,
  trip_paid: localizedCustomerEmailTemplateSchema,
  trip_cancelled: localizedCustomerEmailTemplateSchema,
})

const optionalIndicatorBoundSchema = z.preprocess(
  (value) => {
    if (value === '' || value === null || value === undefined) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  },
  z.number().min(0).nullable(),
)

export const settlementIndicatorRangeSchema = z.object({
  min: optionalIndicatorBoundSchema.default(null),
  max: optionalIndicatorBoundSchema.default(null),
})

export type SettlementIndicatorRangeSettings = z.infer<typeof settlementIndicatorRangeSchema>

export const settlementIndicatorRangesSchema = z.object({
  fuelPerKm: settlementIndicatorRangeSchema.default({ min: null, max: null }),
  revenuePerKm: settlementIndicatorRangeSchema.default({ min: null, max: null }),
})

export type SettlementIndicatorRangesSettings = z.infer<typeof settlementIndicatorRangesSchema>

export function defaultSettlementIndicatorRanges(): SettlementIndicatorRangesSettings {
  return {
    fuelPerKm: { min: null, max: null },
    revenuePerKm: { min: null, max: null },
  }
}

export const taxiFleetPricingSettingsSchema = pricingConfigSchema

export const taxiFleetSettingsSchema = z.object({
  resourceTypeId: z.string().uuid().nullable().optional().default(null),
  defaultPayoutPercent: z.coerce.number().min(0).max(100).default(0),
  customerEmailFrom: z.string().max(500).optional().default(''),
  tripStatuses: tripStatusDictionarySchema.default(defaultTripStatusDictionary()),
  pricing: taxiFleetPricingSettingsSchema.default(defaultFleetPricingConfig()),
  paypal: taxiFleetPaypalSettingsSchema,
  calendar: taxiFleetCalendarSettingsSchema,
  customerEmails: customerEmailsSchema,
  settlementIndicatorRanges: settlementIndicatorRangesSchema.default(defaultSettlementIndicatorRanges()),
})

export type TaxiFleetSettings = z.infer<typeof taxiFleetSettingsSchema>

export type TaxiFleetPricingSettings = PricingConfig

export type TaxiFleetSettingsSecretsMeta = {
  paypalClientSecretConfigured: boolean
  calendarPrivateKeyConfigured: boolean
}

export type TaxiFleetSettingsResponse = TaxiFleetSettings &
  TaxiFleetSettingsSecretsMeta & {
    /** Resolved filter for fleet vehicle pickers; null when unset or configured type no longer exists. */
    effectiveResourceTypeId?: string | null
  }

const defaultCustomerEmailTemplates: Record<TaxiFleetCustomerEmailEvent, LocalizedCustomerEmailTemplate> = {
  trip_created: {
    enabled: true,
    subjectPl: 'Potwierdzenie zlecenia kursu {requestId}',
    subjectEn: 'Trip request confirmation {requestId}',
    preheaderPl: 'Otrzymaliśmy Twoje zlecenie kursu {requestId}',
    preheaderEn: 'We received your trip request {requestId}',
    headingPl: 'Zlecenie kursu przyjęte',
    headingEn: 'Trip request received',
    introPl: 'Dziękujemy za złożenie zlecenia kursu ({requestId}). Skontaktujemy się w celu potwierdzenia szczegółów.',
    introEn: 'Thank you for your trip request ({requestId}). We will contact you to confirm the details.',
    footerNotePl: 'To wiadomość automatyczna od RS Moto Taxi.',
    footerNoteEn: 'This is an automated message from RS Moto Taxi.',
  },
  trip_approved: {
    enabled: true,
    subjectPl: 'Płatność za zlecenie kursu {requestId}',
    subjectEn: 'Payment for trip request {requestId}',
    preheaderPl: 'Dokończ płatność za zlecenie kursu {requestId}',
    preheaderEn: 'Complete payment for trip request {requestId}',
    headingPl: 'Dokończ płatność',
    headingEn: 'Complete your payment',
    introPl: 'Twoje zlecenie kursu {requestId} zostało zaakceptowane. Opłać kurs, klikając link w wiadomości operatora.',
    introEn: 'Your trip request {requestId} has been approved. Please complete payment using the link provided by our team.',
    footerNotePl: '',
    footerNoteEn: '',
  },
  trip_paid: {
    enabled: true,
    subjectPl: 'Płatność potwierdzona — zlecenie {requestId}',
    subjectEn: 'Payment confirmed — trip request {requestId}',
    preheaderPl: 'Płatność za zlecenie kursu {requestId} została potwierdzona',
    preheaderEn: 'Payment confirmed for trip request {requestId}',
    headingPl: 'Płatność potwierdzona',
    headingEn: 'Payment confirmed',
    introPl: 'Płatność za zlecenie kursu {requestId} została potwierdzona. Dziękujemy — skontaktujemy się z dalszymi informacjami.',
    introEn: 'Payment for trip request {requestId} has been confirmed. Thank you — we will contact you with further details.',
    footerNotePl: '',
    footerNoteEn: '',
  },
  trip_cancelled: {
    enabled: true,
    subjectPl: 'Zlecenie kursu {requestId} anulowane',
    subjectEn: 'Trip request {requestId} cancelled',
    preheaderPl: 'Zlecenie kursu {requestId} zostało anulowane',
    preheaderEn: 'Trip request {requestId} has been cancelled',
    headingPl: 'Zlecenie anulowane',
    headingEn: 'Trip cancelled',
    introPl: 'Informujemy, że zlecenie kursu {requestId} zostało anulowane. W razie pytań skontaktuj się z nami.',
    introEn: 'Your trip request {requestId} has been cancelled. Contact us if you have any questions.',
    footerNotePl: '',
    footerNoteEn: '',
  },
}

export function defaultTaxiFleetSettings(): TaxiFleetSettings {
  return taxiFleetSettingsSchema.parse({
    resourceTypeId: null,
    defaultPayoutPercent: 0,
    customerEmailFrom: '',
    tripStatuses: defaultTripStatusDictionary(),
    pricing: defaultFleetPricingConfig(),
    paypal: {
      enabled: false,
      clientId: '',
      clientSecret: '',
      mode: 'sandbox',
      currency: 'PLN',
      confirmationPageBase: '',
      paymentCancelUrl: '',
    },
    calendar: {
      enabled: false,
      calendarId: 'primary',
      timezone: 'Europe/Warsaw',
      serviceAccountEmail: '',
      serviceAccountPrivateKey: '',
      defaultDurationMinutes: 60,
    },
    customerEmails: defaultCustomerEmailTemplates,
    settlementIndicatorRanges: defaultSettlementIndicatorRanges(),
  })
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function parseTaxiFleetSettingsJson(raw: unknown): TaxiFleetSettings {
  const base = defaultTaxiFleetSettings()
  if (!raw || typeof raw !== 'object') return base
  const record = raw as Record<string, unknown>
  const customerEmailsRaw = asRecord(record.customerEmails)
  const pricingRaw = record.pricing
  const indicatorRangesRaw = asRecord(record.settlementIndicatorRanges)
  const fuelRangeRaw = asRecord(indicatorRangesRaw.fuelPerKm)
  const revenueRangeRaw = asRecord(indicatorRangesRaw.revenuePerKm)
  return taxiFleetSettingsSchema.parse({
    ...base,
    ...record,
    tripStatuses: mergeTripStatusDictionary(record.tripStatuses),
    pricing:
      pricingRaw && typeof pricingRaw === 'object'
        ? { ...base.pricing, ...(pricingRaw as Record<string, unknown>) }
        : base.pricing,
    paypal: { ...base.paypal, ...asRecord(record.paypal) },
    calendar: { ...base.calendar, ...asRecord(record.calendar) },
    customerEmails: {
      trip_created: { ...base.customerEmails.trip_created, ...asRecord(customerEmailsRaw.trip_created) },
      trip_approved: { ...base.customerEmails.trip_approved, ...asRecord(customerEmailsRaw.trip_approved) },
      trip_paid: { ...base.customerEmails.trip_paid, ...asRecord(customerEmailsRaw.trip_paid) },
      trip_cancelled: { ...base.customerEmails.trip_cancelled, ...asRecord(customerEmailsRaw.trip_cancelled) },
    },
    settlementIndicatorRanges: {
      fuelPerKm: { ...base.settlementIndicatorRanges.fuelPerKm, ...fuelRangeRaw },
      revenuePerKm: { ...base.settlementIndicatorRanges.revenuePerKm, ...revenueRangeRaw },
    },
  })
}

export function normalizeTaxiFleetSettingsResponse(
  raw: unknown,
): TaxiFleetSettingsResponse {
  const record = asRecord(raw)
  const settings = parseTaxiFleetSettingsJson(raw)
  const response = toTaxiFleetSettingsResponse(settings)
  const configuredTypeId = settings.resourceTypeId ?? null
  const effectiveResourceTypeId =
    record.effectiveResourceTypeId === null || typeof record.effectiveResourceTypeId === 'string'
      ? (record.effectiveResourceTypeId as string | null)
      : configuredTypeId
  return {
    ...response,
    effectiveResourceTypeId,
    paypalClientSecretConfigured:
      record.paypalClientSecretConfigured === true || response.paypalClientSecretConfigured,
    calendarPrivateKeyConfigured:
      record.calendarPrivateKeyConfigured === true || response.calendarPrivateKeyConfigured,
  }
}

export function mergeTaxiFleetSettingsForSave(
  current: TaxiFleetSettings,
  incoming: TaxiFleetSettings,
  secrets: { paypalClientSecret?: string | null; calendarPrivateKey?: string | null },
): TaxiFleetSettings {
  const paypalSecret = incoming.paypal.clientSecret?.trim()
  const calendarKey = incoming.calendar.serviceAccountPrivateKey?.trim()
  return {
    ...incoming,
    paypal: {
      ...incoming.paypal,
      clientSecret:
        paypalSecret && paypalSecret !== '********'
          ? paypalSecret
          : secrets.paypalClientSecret ?? current.paypal.clientSecret,
    },
    calendar: {
      ...incoming.calendar,
      serviceAccountPrivateKey:
        calendarKey && calendarKey !== '********'
          ? calendarKey
          : secrets.calendarPrivateKey ?? current.calendar.serviceAccountPrivateKey,
    },
  }
}

export function toTaxiFleetSettingsResponse(
  settings: TaxiFleetSettings,
): TaxiFleetSettingsResponse {
  return {
    ...settings,
    paypal: {
      ...settings.paypal,
      clientSecret: settings.paypal.clientSecret?.trim() ? '********' : '',
    },
    calendar: {
      ...settings.calendar,
      serviceAccountPrivateKey: settings.calendar.serviceAccountPrivateKey?.trim() ? '********' : '',
    },
    paypalClientSecretConfigured: Boolean(settings.paypal.clientSecret?.trim()),
    calendarPrivateKeyConfigured: Boolean(settings.calendar.serviceAccountPrivateKey?.trim()),
  }
}
