import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { resolveCrudRecordId, parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { TaxiFleetTrip } from '../data/entities'
import { tripCreateSchema, tripUpdateSchema } from '../data/validators'
import {
  createTaxiFleetCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from './openapi'

import { applyFleetDriverListScope } from '../lib/backendFleetActor'
import { transformTripListItem } from '../lib/listItemFields'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.view'] },
  POST: { requireAuth: true, requireAnyFeatures: ['taxi_fleet.manage_trips', 'taxi_fleet.driver'] },
  PUT: { requireAuth: true, requireAnyFeatures: ['taxi_fleet.manage_trips', 'taxi_fleet.driver'] },
  DELETE: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_trips'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(500).default(50),
    ids: z.string().optional(),
    teamMemberId: z.string().uuid().optional(),
    resourceId: z.string().uuid().optional(),
    tripType: z.string().optional(),
    status: z.string().optional(),
    unscheduled: z.coerce.boolean().optional(),
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
    entity: TaxiFleetTrip,
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
      'resource_id',
      'assignment_id',
      'trip_type',
      'started_at',
      'ended_at',
      'distance_km',
      'revenue_amount',
      'currency_code',
      'customer_person_id',
      'customer_company_id',
      'status',
      'notes',
      'metadata',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      startedAt: 'started_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    buildFilters: async (query, ctx) => {
      const filters: Record<string, unknown> = {}
      const ids = parseIds(query.ids)
      if (ids.length) filters.id = { $in: ids }
      if (query.resourceId) filters.resource_id = query.resourceId
      if (query.tripType) filters.trip_type = query.tripType
      if (query.status) filters.status = query.status
      if (query.unscheduled === true) filters.team_member_id = null
      if (query.dateFrom || query.dateTo) {
        const range: Record<string, Date> = {}
        if (query.dateFrom) range.$gte = new Date(query.dateFrom)
        if (query.dateTo) range.$lte = new Date(query.dateTo)
        filters.started_at = range
      }
      return applyFleetDriverListScope(ctx, filters, query.teamMemberId)
    },
    transformItem: (item) => transformTripListItem(item as Record<string, unknown>),
  },
  actions: {
    create: {
      commandId: 'taxi_fleet.trips.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(tripCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: (result as { tripId: string }).tripId }),
      status: 201,
    },
    update: {
      commandId: 'taxi_fleet.trips.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(tripUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'taxi_fleet.trips.delete',
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
  tripType: z.string(),
  status: z.string(),
  customerPersonId: z.string().uuid().nullable().optional(),
  customerCompanyId: z.string().uuid().nullable().optional(),
})

export const openApi = createTaxiFleetCrudOpenApi({
  resourceName: 'Trip',
  pluralName: 'Trips',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(rowSchema),
  create: { schema: tripCreateSchema },
  update: { schema: tripUpdateSchema, responseSchema: defaultOkResponseSchema },
  del: { schema: z.object({ id: z.string().uuid() }), responseSchema: defaultOkResponseSchema },
})
