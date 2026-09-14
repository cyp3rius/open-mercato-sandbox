import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput, resolveCrudRecordId } from '@open-mercato/shared/lib/api/scoped'
import { TaxiFleetVehicleMonthlySettlement } from '../data/entities'
import {
  vehicleMonthlySettlementDeleteSchema,
  vehicleMonthlySettlementUpdateSchema,
} from '../data/validators'
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
    resourceId: z.string().uuid().optional(),
    monthStart: z.string().optional(),
    status: z.string().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: TaxiFleetVehicleMonthlySettlement,
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
      'resource_id',
      'month_start',
      'shift_gps_km',
      'trip_km',
      'empty_km',
      'geneta_km',
      'revenue_gross',
      'revenue_net',
      'bp_fuel_cost',
      'cash_expected',
      'cash_reported',
      'status',
      'submitted_at',
      'approved_at',
      'notes',
      'snapshot_json',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      monthStart: 'month_start',
      createdAt: 'created_at',
      resourceId: 'resource_id',
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.ids) {
        const ids = query.ids.split(',').map((item) => item.trim()).filter(Boolean)
        if (ids.length) filters.id = { $in: ids }
      }
      if (query.resourceId) filters.resource_id = query.resourceId
      if (query.monthStart) filters.month_start = normalizeDateOnly(query.monthStart) || query.monthStart
      if (query.status) filters.status = query.status
      return filters
    },
  },
  actions: {
    update: {
      commandId: 'taxi_fleet.vehicle_monthly_settlements.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(vehicleMonthlySettlementUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'taxi_fleet.vehicle_monthly_settlements.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, raw, ctx }) => {
        const { translate } = await resolveTranslations()
        const id = resolveCrudRecordId(parsed, ctx, translate)
        return parseScopedCommandInput(
          vehicleMonthlySettlementDeleteSchema,
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
  resourceId: z.string().uuid(),
  monthStart: z.string(),
  status: z.string(),
  cashExpected: z.string(),
  cashReported: z.string(),
  shiftGpsKm: z.string(),
})

export const openApi = createTaxiFleetCrudOpenApi({
  resourceName: 'Vehicle monthly settlement',
  pluralName: 'Vehicle monthly settlements',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(rowSchema),
  update: { schema: vehicleMonthlySettlementUpdateSchema, responseSchema: defaultOkResponseSchema },
  del: { schema: vehicleMonthlySettlementDeleteSchema, responseSchema: defaultOkResponseSchema },
})
