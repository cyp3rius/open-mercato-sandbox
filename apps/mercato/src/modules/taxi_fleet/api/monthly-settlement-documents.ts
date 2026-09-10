import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput, resolveCrudRecordId } from '@open-mercato/shared/lib/api/scoped'
import { TaxiFleetMonthlySettlementDocument } from '../data/entities'
import {
  monthlySettlementDocumentCreateSchema,
  monthlySettlementDocumentDeleteSchema,
} from '../data/validators'
import {
  createTaxiFleetCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from './openapi'
import { normalizeDateOnly } from '../lib/weekUtils'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.view'] },
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_settlements'] },
  DELETE: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_settlements'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    monthStart: z.string().optional(),
    kind: z.string().optional(),
    resourceId: z.string().uuid().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: TaxiFleetMonthlySettlementDocument,
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
      'month_start',
      'kind',
      'resource_id',
      'attachment_id',
      'file_name',
      'parsed_json',
      'notes',
      'uploaded_by_user_id',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: { monthStart: 'month_start', createdAt: 'created_at' },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.monthStart) filters.month_start = normalizeDateOnly(query.monthStart) || query.monthStart
      if (query.kind) filters.kind = query.kind
      if (query.resourceId) filters.resource_id = query.resourceId
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'taxi_fleet.monthly_settlement_documents.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(monthlySettlementDocumentCreateSchema, raw ?? {}, ctx, translate)
      },
      response: (result) => ({ id: (result as { documentId?: string } | undefined)?.documentId ?? null }),
    },
    delete: {
      commandId: 'taxi_fleet.monthly_settlement_documents.delete',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx, id }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(
          monthlySettlementDocumentDeleteSchema,
          { ...(raw ?? {}), id: resolveCrudRecordId(id, raw) },
          ctx,
          translate,
        )
      },
      response: () => ({ ok: true }),
    },
  },
})

export const GET = crud.GET
export const POST = crud.POST
export const DELETE = crud.DELETE

const rowSchema = z.object({
  id: z.string().uuid(),
  monthStart: z.string(),
  kind: z.string(),
  resourceId: z.string().uuid().nullable().optional(),
  fileName: z.string().nullable().optional(),
})

export const openApi = createTaxiFleetCrudOpenApi({
  resourceName: 'Monthly settlement document',
  pluralName: 'Monthly settlement documents',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(rowSchema),
  create: { schema: monthlySettlementDocumentCreateSchema, responseSchema: z.object({ id: z.string().uuid().nullable() }) },
  del: { schema: monthlySettlementDocumentDeleteSchema, responseSchema: defaultOkResponseSchema },
})
