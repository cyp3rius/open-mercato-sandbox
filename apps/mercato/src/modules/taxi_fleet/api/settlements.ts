import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput, resolveCrudRecordId } from '@open-mercato/shared/lib/api/scoped'
import { TaxiFleetWeeklySettlement } from '../data/entities'
import { settlementDeleteSchema, settlementUpdateSchema } from '../data/validators'
import {
  createTaxiFleetCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from './openapi'

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
    weekStart: z.string().optional(),
    status: z.string().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: TaxiFleetWeeklySettlement,
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
      'week_start',
      'total_revenue',
      'total_costs',
      'revenue_gross',
      'revenue_net',
      'costs_gross',
      'costs_net',
      'net_amount',
      'payout_percent',
      'payout_amount',
      'computed_distance_km',
      'total_distance_km',
      'cash_expected',
      'cash_collected',
      'bonus_amount',
      'compensation_amount',
      'airport_a4_amount',
      'transfer_amount',
      'status',
      'submitted_at',
      'approved_at',
      'closure_type',
      'closure_amount',
      'closed_at',
      'snapshot_json',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: { weekStart: 'week_start', createdAt: 'created_at' },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.ids) {
        const ids = query.ids.split(',').map((item) => item.trim()).filter(Boolean)
        if (ids.length) filters.id = { $in: ids }
      }
      if (query.teamMemberId) filters.team_member_id = query.teamMemberId
      if (query.weekStart) filters.week_start = query.weekStart
      if (query.status) filters.status = query.status
      return filters
    },
  },
  hooks: {
    afterList: async (payload, ctx) => {
      const items = Array.isArray(payload.items) ? [...payload.items] : []
      if (!items.length) return

      const query = (ctx.query ?? {}) as {
        page?: number
        pageSize?: number
        sortField?: string
        sortDir?: 'asc' | 'desc'
      }
      const sortField = query.sortField === 'createdAt' ? 'createdAt' : 'weekStart'
      const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc'

      const readWeekStart = (item: Record<string, unknown>) =>
        String(item.weekStart ?? item.week_start ?? '')
      const readCreatedAt = (item: Record<string, unknown>) => {
        const raw = item.createdAt ?? item.created_at
        if (raw instanceof Date) return raw.getTime()
        if (typeof raw === 'string' || typeof raw === 'number') {
          const parsed = new Date(raw).getTime()
          return Number.isFinite(parsed) ? parsed : 0
        }
        return 0
      }

      items.sort((left, right) => {
        const leftRecord = left as Record<string, unknown>
        const rightRecord = right as Record<string, unknown>
        if (sortField === 'createdAt') {
          const createdDiff = readCreatedAt(leftRecord) - readCreatedAt(rightRecord)
          if (createdDiff !== 0) return sortDir === 'desc' ? -createdDiff : createdDiff
          const weekDiff = readWeekStart(leftRecord).localeCompare(readWeekStart(rightRecord))
          return sortDir === 'desc' ? -weekDiff : weekDiff
        }
        const weekDiff = readWeekStart(leftRecord).localeCompare(readWeekStart(rightRecord))
        if (weekDiff !== 0) return sortDir === 'desc' ? -weekDiff : weekDiff
        const createdDiff = readCreatedAt(leftRecord) - readCreatedAt(rightRecord)
        return sortDir === 'desc' ? -createdDiff : createdDiff
      })

      const page = query.page ?? 1
      const pageSize = query.pageSize ?? 50
      const total = items.length
      const offset = (page - 1) * pageSize
      payload.items = items.slice(offset, offset + pageSize)
      payload.total = total
      payload.page = page
      payload.pageSize = pageSize
      payload.totalPages = Math.max(1, Math.ceil(total / pageSize))
    },
  },
  actions: {
    update: {
      commandId: 'taxi_fleet.settlements.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(settlementUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'taxi_fleet.settlements.delete',
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
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const rowSchema = z.object({
  id: z.string().uuid(),
  teamMemberId: z.string().uuid(),
  weekStart: z.string(),
  status: z.string(),
  payoutAmount: z.string(),
})

export const openApi = createTaxiFleetCrudOpenApi({
  resourceName: 'Weekly settlement',
  pluralName: 'Weekly settlements',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(rowSchema),
  update: { schema: settlementUpdateSchema, responseSchema: defaultOkResponseSchema },
  del: { schema: settlementDeleteSchema, responseSchema: defaultOkResponseSchema },
})
