import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput, resolveCrudRecordId } from '@open-mercato/shared/lib/api/scoped'
import { TaxiFleetMonthlySettlement } from '../data/entities'
import { monthlySettlementDeleteSchema, monthlySettlementUpdateSchema } from '../data/validators'
import {
  createTaxiFleetCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from './openapi'
import { normalizeDateOnly } from '../lib/weekUtils'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.view'] },
  PUT: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_settlements'] },
  DELETE: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_settlements'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    ids: z.string().optional(),
    teamMemberId: z.string().uuid().optional(),
    monthStart: z.string().optional(),
    status: z.string().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: TaxiFleetMonthlySettlement,
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
      'month_start',
      'revenue_gross',
      'revenue_net',
      'costs_gross',
      'costs_net',
      'net_amount',
      'payout_percent',
      'payout_amount',
      'computed_distance_km',
      'total_distance_km',
      'empty_distance_km',
      'cash_expected',
      'cash_collected',
      'bonus_amount',
      'compensation_amount',
      'airport_a4_amount',
      'transfer_amount',
      'weekly_count',
      'driver_count',
      'status',
      'submitted_at',
      'approved_at',
      'closure_type',
      'closure_amount',
      'closed_at',
      'notes',
      'snapshot_json',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: { monthStart: 'month_start', createdAt: 'created_at', teamMemberId: 'team_member_id' },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.ids) {
        const ids = query.ids.split(',').map((item) => item.trim()).filter(Boolean)
        if (ids.length) filters.id = { $in: ids }
      }
      if (query.teamMemberId) filters.team_member_id = query.teamMemberId
      if (query.monthStart) filters.month_start = normalizeDateOnly(query.monthStart) || query.monthStart
      if (query.status) filters.status = query.status
      return filters
    },
  },
  actions: {
    update: {
      commandId: 'taxi_fleet.monthly_settlements.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(monthlySettlementUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'taxi_fleet.monthly_settlements.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const id = resolveCrudRecordId(parsed, ctx, translate)
        return parseScopedCommandInput(
          monthlySettlementDeleteSchema,
          { ...(raw ?? {}), id },
          ctx,
          translate,
        )
      },
      response: () => ({ ok: true }),
    },
  },
})

export const GET = crud.GET
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const rowSchema = z.object({
  id: z.string().uuid(),
  teamMemberId: z.string().uuid(),
  monthStart: z.string(),
  status: z.string(),
  revenueNet: z.string(),
  payoutAmount: z.string(),
  transferAmount: z.string(),
  weeklyCount: z.number(),
})

export const openApi = createTaxiFleetCrudOpenApi({
  resourceName: 'Monthly settlement',
  pluralName: 'Monthly settlements',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(rowSchema),
  update: { schema: monthlySettlementUpdateSchema, responseSchema: defaultOkResponseSchema },
  del: { schema: monthlySettlementDeleteSchema, responseSchema: defaultOkResponseSchema },
})
