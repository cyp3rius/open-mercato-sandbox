import { z } from 'zod'
import { localizedCustomerEmailTemplateSchema } from '../lib/taxiFleetSettings'
import { pricingConfigSchema } from '../lib/pricing/pricingConfigSchema'
import { tripStatusDictionarySchema } from '../lib/tripStatuses'

const uuid = z.string().uuid()
const optionalUuid = z.string().uuid().optional().nullable()
const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const assignmentStatusSchema = z.enum(['planned', 'confirmed', 'completed', 'cancelled'])
export const tripTypeSchema = z.enum(['client', 'private', 'empty', 'event', 'other'])
export const tripStatusSchema = z.string().trim().min(1).max(64)
export const tripCancelSourceSchema = z.enum(['customer', 'operator', 'driver'])
export const tripPaymentMethodSchema = z.enum(['paypal', 'cash', 'transfer', 'other'])
export const costTypeSchema = z.enum(['fuel', 'toll', 'parking', 'maintenance', 'other'])
export const incomeDocumentTypeSchema = z.enum(['receipt', 'invoice'])
export const financialEntryKindSchema = z.enum(['income', 'expense'])
export const settlementStatusSchema = z.enum(['draft', 'submitted', 'approved', 'paid'])

export const driverProfileCreateSchema = z.object({
  tenantId: uuid,
  organizationId: uuid,
  teamMemberId: uuid,
  payoutPercent: z.coerce.number().min(0).max(100).optional().default(0),
  defaultResourceId: optionalUuid,
  externalAppEnabled: z.boolean().optional().default(false),
})

export const driverProfileUpdateSchema = z.object({
  id: uuid,
  payoutPercent: z.coerce.number().min(0).max(100).optional(),
  defaultResourceId: optionalUuid,
  externalAppEnabled: z.boolean().optional(),
})

export const driverProfileDeleteSchema = z.object({ id: uuid })

export const assignmentCreateSchema = z.object({
  tenantId: uuid,
  organizationId: uuid,
  teamMemberId: uuid,
  resourceId: uuid,
  assignmentDate: dateOnly,
  shiftStart: z.coerce.date().optional().nullable(),
  shiftEnd: z.coerce.date().optional().nullable(),
  status: assignmentStatusSchema.optional().default('planned'),
  notes: z.string().max(5000).optional().nullable(),
})

export const assignmentUpdateSchema = z.object({
  id: uuid,
  teamMemberId: uuid.optional(),
  resourceId: uuid.optional(),
  assignmentDate: dateOnly.optional(),
  shiftStart: z.coerce.date().optional().nullable(),
  shiftEnd: z.coerce.date().optional().nullable(),
  status: assignmentStatusSchema.optional(),
  notes: z.string().max(5000).optional().nullable(),
})

export const assignmentDeleteSchema = z.object({ id: uuid })

export const tripInjectSchema = z.object({
  tenantId: uuid,
  organizationId: uuid,
  externalId: z.string().trim().min(1).max(191),
  source: z.string().trim().min(1).max(120).optional(),
  payload: z.record(z.string(), z.unknown()),
})

export const tripCreateSchema = z
  .object({
    tenantId: uuid,
    organizationId: uuid,
    teamMemberId: uuid,
    resourceId: uuid,
    assignmentId: optionalUuid,
    tripType: tripTypeSchema,
    startedAt: z.coerce.date().optional().nullable(),
    endedAt: z.coerce.date().optional().nullable(),
    odometerStart: z.coerce.number().optional().nullable(),
    odometerEnd: z.coerce.number().optional().nullable(),
    distanceKm: z.coerce.number().optional().nullable(),
    revenueAmount: z.coerce.number().optional().nullable(),
    currencyCode: z.string().min(3).max(3).optional().default('PLN'),
    customerPersonId: optionalUuid,
    customerCompanyId: optionalUuid,
    customerEntityId: optionalUuid,
    status: tripStatusSchema.optional().default('new'),
    notes: z.string().max(10000).optional().nullable(),
    metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const hasPerson = Boolean(data.customerPersonId)
    const hasCompany = Boolean(data.customerCompanyId)
    const hasEntity = Boolean(data.customerEntityId)
    if (hasPerson && hasCompany) {
      ctx.addIssue({
        code: 'custom',
        message: 'taxi_fleet.trips.errors.customerConflict',
        path: ['customerEntityId'],
      })
    }
    if (!hasPerson && !hasCompany && !hasEntity) {
      ctx.addIssue({
        code: 'custom',
        message: 'taxi_fleet.trips.errors.customerRequired',
        path: ['customerEntityId'],
      })
    }
  })

export const tripUpdateSchema = z
  .object({
    id: uuid,
    teamMemberId: uuid.optional(),
    resourceId: uuid.optional(),
    assignmentId: optionalUuid,
    tripType: tripTypeSchema.optional(),
    startedAt: z.coerce.date().optional().nullable(),
    endedAt: z.coerce.date().optional().nullable(),
    odometerStart: z.coerce.number().optional().nullable(),
    odometerEnd: z.coerce.number().optional().nullable(),
    distanceKm: z.coerce.number().optional().nullable(),
    revenueAmount: z.coerce.number().optional().nullable(),
    currencyCode: z.string().min(3).max(3).optional(),
    customerPersonId: optionalUuid,
    customerCompanyId: optionalUuid,
    customerEntityId: optionalUuid,
    status: tripStatusSchema.optional(),
    notes: z.string().max(10000).optional().nullable(),
    metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const touched =
      data.customerPersonId !== undefined ||
      data.customerCompanyId !== undefined ||
      data.customerEntityId !== undefined
    if (!touched) return
    const hasPerson = Boolean(data.customerPersonId)
    const hasCompany = Boolean(data.customerCompanyId)
    const hasEntity = Boolean(data.customerEntityId)
    if (hasPerson && hasCompany) {
      ctx.addIssue({
        code: 'custom',
        message: 'taxi_fleet.trips.errors.customerConflict',
        path: ['customerEntityId'],
      })
    }
    if (!hasPerson && !hasCompany && !hasEntity) {
      ctx.addIssue({
        code: 'custom',
        message: 'taxi_fleet.trips.errors.customerRequired',
        path: ['customerEntityId'],
      })
    }
  })

export const tripDeleteSchema = z.object({ id: uuid })
export const tripApproveSchema = z.object({ id: uuid })
export const tripRejectSchema = z.object({ id: uuid, notes: z.string().max(5000).optional().nullable() })
export const tripScheduleSchema = z.object({ id: uuid })
export const tripCompleteSchema = z.object({ id: uuid })
export const tripCancelSchema = z.object({
  id: uuid,
  cancelSource: tripCancelSourceSchema,
  reason: z.string().max(5000).optional().nullable(),
})
export const tripMarkPaidSchema = z.object({
  id: uuid,
  paymentMethod: tripPaymentMethodSchema.optional().default('paypal'),
  paymentReference: z.string().max(500).optional().nullable(),
})

export const tripCostLineCreateSchema = z.object({
  tenantId: uuid,
  organizationId: uuid,
  tripId: uuid,
  costType: costTypeSchema,
  amount: z.coerce.number().positive(),
  currencyCode: z.string().min(3).max(3).optional().default('PLN'),
  quantity: z.coerce.number().optional().nullable(),
  unitPrice: z.coerce.number().optional().nullable(),
  receiptAttachmentId: optionalUuid,
  notes: z.string().max(5000).optional().nullable(),
})

export const tripCostLineDeleteSchema = z.object({ id: uuid })

const financialEntryBaseSchema = z.object({
  tenantId: uuid,
  organizationId: uuid,
  teamMemberId: uuid,
  kind: financialEntryKindSchema,
  incomeDocumentType: incomeDocumentTypeSchema.optional().nullable(),
  costType: costTypeSchema.optional().nullable(),
  tripId: optionalUuid,
  customerPersonId: optionalUuid,
  customerCompanyId: optionalUuid,
  customerEntityId: optionalUuid,
  amount: z.coerce.number().positive(),
  currencyCode: z.string().min(3).max(3).optional().default('PLN'),
  documentNumber: z.string().max(120).optional().nullable(),
  occurredAt: z.coerce.date(),
  receiptAttachmentId: optionalUuid,
  notes: z.string().max(5000).optional().nullable(),
})

function refineFinancialEntry(data: z.infer<typeof financialEntryBaseSchema>, ctx: z.RefinementCtx) {
  if (data.kind === 'income') {
    if (!data.incomeDocumentType) {
      ctx.addIssue({
        code: 'custom',
        message: 'taxi_fleet.financial.errors.incomeDocumentTypeRequired',
        path: ['incomeDocumentType'],
      })
    }
    const hasPerson = Boolean(data.customerPersonId)
    const hasCompany = Boolean(data.customerCompanyId)
    const hasEntity = Boolean(data.customerEntityId)
    if (!hasPerson && !hasCompany && !hasEntity && !data.tripId) {
      ctx.addIssue({
        code: 'custom',
        message: 'taxi_fleet.trips.errors.customerRequired',
        path: ['customerEntityId'],
      })
    }
    if (hasPerson && hasCompany) {
      ctx.addIssue({
        code: 'custom',
        message: 'taxi_fleet.trips.errors.customerConflict',
        path: ['customerEntityId'],
      })
    }
    return
  }
  if (!data.costType) {
    ctx.addIssue({
      code: 'custom',
      message: 'taxi_fleet.financial.errors.costTypeRequired',
      path: ['costType'],
    })
  }
}

export const financialEntryCreateSchema = financialEntryBaseSchema.superRefine(refineFinancialEntry)

export const financialEntryUpdateSchema = z.object({
  id: uuid,
  incomeDocumentType: incomeDocumentTypeSchema.optional().nullable(),
  costType: costTypeSchema.optional().nullable(),
  tripId: optionalUuid,
  customerPersonId: optionalUuid,
  customerCompanyId: optionalUuid,
  customerEntityId: optionalUuid,
  amount: z.coerce.number().positive().optional(),
  currencyCode: z.string().min(3).max(3).optional(),
  documentNumber: z.string().max(120).optional().nullable(),
  occurredAt: z.coerce.date().optional(),
  receiptAttachmentId: optionalUuid,
  notes: z.string().max(5000).optional().nullable(),
})

export const financialEntryDeleteSchema = z.object({ id: uuid })

export const settlementGenerateSchema = z.object({
  tenantId: uuid,
  organizationId: uuid,
  teamMemberId: uuid,
  weekStart: dateOnly,
})

export const settlementUpdateSchema = z.object({
  id: uuid,
  status: settlementStatusSchema.optional(),
})

export const settlementSubmitSchema = z.object({
  weekStart: dateOnly,
})

export const suggestDriversQuerySchema = z.object({
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date(),
  limit: z.coerce.number().min(1).max(20).optional(),
})

export const taxiFleetSettingsPutSchema = z.object({
  resourceTypeId: z.string().uuid().nullable().optional(),
  defaultPayoutPercent: z.coerce.number().min(0).max(100),
  customerEmailFrom: z.string().max(500).optional().default(''),
  tripStatuses: tripStatusDictionarySchema.optional(),
  paypal: z.object({
    enabled: z.boolean(),
    clientId: z.string().max(500).optional().default(''),
    clientSecret: z.string().max(500).optional().default(''),
    mode: z.enum(['sandbox', 'live']),
    currency: z.string().min(3).max(3),
    confirmationPageBase: z.string().max(2000).optional().default(''),
    paymentCancelUrl: z.string().max(2000).optional().default(''),
  }),
  calendar: z.object({
    enabled: z.boolean(),
    calendarId: z.string().max(500).optional().default('primary'),
    timezone: z.string().max(120),
    serviceAccountEmail: z.string().max(500).optional().default(''),
    serviceAccountPrivateKey: z.string().max(20000).optional().default(''),
    defaultDurationMinutes: z.coerce.number().int().min(15).max(1440),
  }),
  customerEmails: z.object({
    trip_created: localizedCustomerEmailTemplateSchema,
    trip_approved: localizedCustomerEmailTemplateSchema,
    trip_paid: localizedCustomerEmailTemplateSchema,
    trip_cancelled: localizedCustomerEmailTemplateSchema,
  }),
  pricing: pricingConfigSchema.optional(),
})

export type TaxiFleetSettingsPutInput = z.infer<typeof taxiFleetSettingsPutSchema>

export type DriverProfileCreateInput = z.infer<typeof driverProfileCreateSchema>
export type DriverProfileUpdateInput = z.infer<typeof driverProfileUpdateSchema>
export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>
export type AssignmentUpdateInput = z.infer<typeof assignmentUpdateSchema>
export type TripInjectInput = z.infer<typeof tripInjectSchema>
export type TripCreateInput = z.infer<typeof tripCreateSchema>
export type TripUpdateInput = z.infer<typeof tripUpdateSchema>
export type TripCancelInput = z.infer<typeof tripCancelSchema>
export type TripMarkPaidInput = z.infer<typeof tripMarkPaidSchema>
export type TripCostLineCreateInput = z.infer<typeof tripCostLineCreateSchema>
export type FinancialEntryCreateInput = z.infer<typeof financialEntryCreateSchema>
export type FinancialEntryUpdateInput = z.infer<typeof financialEntryUpdateSchema>
export type SettlementGenerateInput = z.infer<typeof settlementGenerateSchema>

const routeLocaleSchema = z.enum(['pl', 'en']).default('pl')

export const routePlacesAutocompleteQuerySchema = z.object({
  input: z.string().max(500).default(''),
  lang: routeLocaleSchema,
  filter: z.enum(['airport']).optional(),
})

export const routeReverseGeocodeQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  lang: routeLocaleSchema,
})

const routeDistanceStopSchema = z.object({
  address: z.string().trim().min(1).max(500),
  lon: z.coerce.number().optional(),
  lat: z.coerce.number().optional(),
})

export const routeDistanceBodySchema = z.object({
  stops: z.array(routeDistanceStopSchema).min(2).optional(),
  from: z.string().trim().max(500).optional(),
  to: z.string().trim().max(500).optional(),
  fromLon: z.coerce.number().optional(),
  fromLat: z.coerce.number().optional(),
  toLon: z.coerce.number().optional(),
  toLat: z.coerce.number().optional(),
  lang: routeLocaleSchema.optional(),
})

const quoteTimeSchema = z.string().regex(/^\d{2}:\d{2}$/)
const quoteDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const quoteBodySchema = z.object({
  organizationId: uuid.optional(),
  tenantId: uuid.optional(),
  serviceType: z.enum(['airport', 'local']),
  passengers: z.coerce.number().int().min(1).max(8),
  distanceKm: z.coerce.number().positive(),
  date: quoteDateSchema,
  time: quoteTimeSchema,
  handLuggage: z.coerce.number().int().min(0).default(0),
  holdLuggage: z.coerce.number().int().min(0).optional(),
  childSeats: z.coerce.number().int().min(0).default(0),
  boosterSeats: z.coerce.number().int().min(0).default(0),
  meetAndGreet: z.boolean().optional(),
  englishSpeakingDriver: z.boolean().optional(),
  isPublicHoliday: z.boolean().optional(),
  vehicleCategory: z.enum(['standard', 'van']).optional(),
})

const quoteSurchargeSchema = z.object({
  code: z.string(),
  label: z.string(),
  amount: z.number(),
})

export const quoteResponseSchema = z.object({
  currency: z.string(),
  vehicleCategory: z.enum(['standard', 'van']),
  basePrice: z.number(),
  surcharges: z.array(quoteSurchargeSchema),
  totalPrice: z.number(),
  warnings: z.array(z.string()).optional(),
})

export type QuoteBodyInput = z.infer<typeof quoteBodySchema>
export type SettlementUpdateInput = z.infer<typeof settlementUpdateSchema>
export type SettlementSubmitInput = z.infer<typeof settlementSubmitSchema>
