import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { resolveCrudRecordId, parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { TaxiFleetFinancialEntry } from '../data/entities'
import { financialEntryCreateSchema, financialEntryUpdateSchema } from '../data/validators'
import {
  createTaxiFleetCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from './openapi'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.view'] },
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_settlements'] },
  PUT: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_settlements'] },
  DELETE: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_settlements'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(500).default(50),
    ids: z.string().optional(),
    teamMemberId: z.string().uuid().optional(),
    kind: z.enum(['income', 'expense']).optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .passthrough()

const parseIds = (value?: string) => {
  if (!value) return []
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: TaxiFleetFinancialEntry,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  list: {
    schema: listSchema,
    fields: [
      'id',
      'organization_id',
      'tenant_id',
      'team_member_id',
      'kind',
      'income_document_type',
      'cost_type',
      'trip_id',
      'customer_person_id',
      'customer_company_id',
      'amount',
      'vat_rate_percent',
      'currency_code',
      'document_number',
      'occurred_at',
      'receipt_attachment_id',
      'notes',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      occurredAt: 'occurred_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      amount: 'amount',
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      const ids = parseIds(query.ids)
      if (ids.length) filters.id = { $in: ids }
      if (query.teamMemberId) filters.team_member_id = query.teamMemberId
      if (query.kind) filters.kind = query.kind
      if (query.dateFrom || query.dateTo) {
        const range: Record<string, Date> = {}
        if (query.dateFrom) range.$gte = new Date(`${query.dateFrom}T00:00:00`)
        if (query.dateTo) range.$lte = new Date(`${query.dateTo}T23:59:59`)
        filters.occurred_at = range
      }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'taxi_fleet.financial_entries.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(financialEntryCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: (result as { entryId: string }).entryId }),
      status: 201,
    },
    update: {
      commandId: 'taxi_fleet.financial_entries.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(financialEntryUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'taxi_fleet.financial_entries.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => {
        const { translate } = await resolveTranslations()
        const id = resolveCrudRecordId(parsed, ctx, translate)
        return { id }
      },
      response: () => ({ ok: true }),
    },
  },
})

export const GET = crud.GET
export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const rowSchema = z.object({
  id: z.string().uuid(),
  teamMemberId: z.string().uuid(),
  kind: z.enum(['income', 'expense']),
  incomeDocumentType: z.enum(['receipt', 'invoice']).nullable().optional(),
  costType: z.string().nullable().optional(),
  tripId: z.string().uuid().nullable().optional(),
  customerPersonId: z.string().uuid().nullable().optional(),
  customerCompanyId: z.string().uuid().nullable().optional(),
  amount: z.string(),
  currencyCode: z.string(),
  documentNumber: z.string().nullable().optional(),
  occurredAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export const openApi = createTaxiFleetCrudOpenApi({
  resourceName: 'Financial entry',
  pluralName: 'Financial entries',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(rowSchema),
  create: { schema: financialEntryCreateSchema },
  update: { schema: financialEntryUpdateSchema, responseSchema: defaultOkResponseSchema },
  del: { schema: z.object({ id: z.string().uuid() }), responseSchema: defaultOkResponseSchema },
})
