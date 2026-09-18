import { z } from 'zod'
import { raw } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { buildScopedWhere } from '@open-mercato/shared/lib/api/crud'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { resolveCrudRecordId, parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { TaxiFleetTrip } from '../data/entities'
import { tripCreateSchema, tripUpdateSchema } from '../data/validators'
import {
  createTaxiFleetCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from './openapi'

import { applyFleetDriverListScope, type FleetActorScopeCtx } from '../lib/backendFleetActor'
import { transformTripListItem } from '../lib/listItemFields'
import { loadSettlementTripReceiptContext } from '../lib/settlementTripReceiptEnrichment'
import {
  TRIP_REQUEST_PAYMENT_TYPES,
  type TripRequestPaymentType,
} from '../lib/tripRequestForm'
import { TAXI_FLEET_TRIP_PLATFORMS } from '../lib/tripPlatforms'
import { mergeIdFilter, resolveTripListSearchIds } from '../lib/tripListSearch'
import { E } from '@/.mercato/generated/entities.ids.generated'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.view'] },
  POST: { requireAuth: true, requireAnyFeatures: ['taxi_fleet.manage_trips', 'taxi_fleet.driver'] },
  PUT: { requireAuth: true, requireAnyFeatures: ['taxi_fleet.manage_trips', 'taxi_fleet.driver'] },
  DELETE: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_trips'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const paymentTypeSchema = z.enum(TRIP_REQUEST_PAYMENT_TYPES)
const platformSchema = z.enum(TAXI_FLEET_TRIP_PLATFORMS)

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(500).default(50),
    ids: z.string().optional(),
    teamMemberId: z.string().uuid().optional(),
    resourceId: z.string().uuid().optional(),
    customerEntityId: z.string().uuid().optional(),
    tripType: z.string().optional(),
    status: z.string().optional(),
    platform: platformSchema.optional(),
    paymentType: paymentTypeSchema.optional(),
    search: z.string().optional(),
    unscheduled: z.coerce.boolean().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    sortField: z.string().optional().default('startedAt'),
    sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  })
  .passthrough()

const parseIds = (value?: string) => {
  if (!value) return []
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

type TripListQuery = z.infer<typeof listSchema>

type TripListCrudCtx = FleetActorScopeCtx & {
  organizationIds?: string[] | null
  query?: TripListQuery
}

function hasTripListFilterQuery(query: TripListQuery | undefined): boolean {
  if (!query) return false
  if (query.unscheduled === true) return true
  if (query.platform) return true
  if (query.paymentType) return true
  if (query.customerEntityId) return true
  if (query.teamMemberId) return true
  if (query.resourceId) return true
  if (typeof query.status === 'string' && query.status.trim()) return true
  if (typeof query.tripType === 'string' && query.tripType.trim()) return true
  if (typeof query.dateFrom === 'string' && query.dateFrom.trim()) return true
  if (typeof query.dateTo === 'string' && query.dateTo.trim()) return true
  if (typeof query.search === 'string' && query.search.trim()) return true
  return parseIds(query.ids).length > 0
}

async function buildTripListFilters(
  query: TripListQuery,
  ctx: TripListCrudCtx,
): Promise<Record<string, unknown>> {
  const filters: Record<string, unknown> = {}
  const ids = parseIds(query.ids)
  if (ids.length) filters.id = { $in: ids }
  if (query.resourceId) filters.resourceId = query.resourceId
  if (query.tripType) {
    const tripTypes = parseIds(query.tripType)
    if (tripTypes.length === 1) filters.tripType = tripTypes[0]
    else if (tripTypes.length > 1) filters.tripType = { $in: tripTypes }
  }
  if (query.status) filters.status = query.status
  if (query.platform) filters.platform = query.platform
  if (query.unscheduled === true) filters.teamMemberId = null
  if (query.customerEntityId) {
    filters.$or = [
      { customerPersonId: query.customerEntityId },
      { customerCompanyId: query.customerEntityId },
      { orderingPersonId: query.customerEntityId },
    ]
  }
  if (query.paymentType) {
    const paymentType = query.paymentType as TripRequestPaymentType
    filters.metadata = { $contains: { tripRequest: { paymentType } } }
  }
  if (query.dateFrom || query.dateTo) {
    const range: Record<string, Date> = {}
    if (query.dateFrom) range.$gte = new Date(query.dateFrom)
    if (query.dateTo) range.$lte = new Date(query.dateTo)
    filters.startedAt = range
  }

  const searchTerm = typeof query.search === 'string' ? query.search.trim() : ''
  if (searchTerm) {
    const tenantId = ctx.auth?.tenantId ?? null
    if (!tenantId) {
      filters.id = { $in: [] }
    } else {
      const em = (ctx.container.resolve('em') as EntityManager).fork()
      const searchIds = await resolveTripListSearchIds({
        search: searchTerm,
        tenantId,
        organizationId: ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null,
        organizationIds: ctx.organizationIds ?? null,
        container: ctx.container,
        em,
      })
      const mergedIds = mergeIdFilter(ids.length ? ids : undefined, searchIds)
      filters.id = { $in: mergedIds }
    }
  }

  return applyFleetDriverListScope(ctx, filters, query.teamMemberId)
}

async function attachFilteredRevenueSummary(
  payload: { revenueSummary?: { revenueAmount: number; currencyCode: string } | null },
  ctx: TripListCrudCtx,
): Promise<void> {
  const query = ctx.query
  if (!hasTripListFilterQuery(query)) {
    payload.revenueSummary = null
    return
  }

  const tenantId = ctx.auth?.tenantId ?? null
  if (!tenantId || !query) {
    payload.revenueSummary = null
    return
  }

  const filters = await buildTripListFilters(query, ctx)
  const where = buildScopedWhere(filters, {
    organizationId: ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null,
    organizationIds: ctx.organizationIds ?? undefined,
    tenantId,
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  })

  const em = ctx.container.resolve('em') as EntityManager
  try {
    const row = await em
      .createQueryBuilder(TaxiFleetTrip, 't')
      .select([raw('coalesce(sum(t.revenue_amount), 0) as total')])
      .where(where)
      .execute<{ total?: string | number | null }>('get')

    const total = Number(row?.total ?? 0)
    payload.revenueSummary = {
      revenueAmount: Number.isFinite(total) ? total : 0,
      currencyCode: 'PLN',
    }
  } catch {
    payload.revenueSummary = {
      revenueAmount: 0,
      currencyCode: 'PLN',
    }
  }
}

async function enrichTripListItemsWithReceiptOcr(
  items: unknown[],
  ctx: { container: { resolve: (name: string) => unknown }; auth?: { tenantId?: string | null; orgId?: string | null } | null; selectedOrganizationId?: string | null },
): Promise<void> {
  if (!Array.isArray(items) || !items.length) return
  const tenantId = ctx.auth?.tenantId ?? null
  const organizationId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
  if (!tenantId || !organizationId) return

  const trips = items.map((item) => {
    const record = item as Record<string, unknown>
    return {
      id: String(record.id ?? ''),
      metadata:
        record.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata)
          ? (record.metadata as Record<string, unknown>)
          : null,
    } as Pick<TaxiFleetTrip, 'id' | 'metadata'>
  }).filter((trip) => trip.id.length > 0)

  if (!trips.length) return

  const em = ctx.container.resolve('em') as EntityManager
  const receiptContext = await loadSettlementTripReceiptContext(em, trips as TaxiFleetTrip[], {
    tenantId,
    organizationId,
  })

  for (const item of items) {
    const record = item as Record<string, unknown>
    const id = typeof record.id === 'string' ? record.id : ''
    if (!id) continue
    const extras = receiptContext.get(id)
    if (!extras) continue
    record.receiptAttachmentId = extras.receiptAttachmentId
    record.ocrStatus = extras.ocrStatus
    record.warnings = extras.receiptWarnings
  }
}

const crud = makeCrudRoute({
  metadata: routeMetadata,
  indexer: { entityType: E.taxi_fleet.taxi_fleet_trip },
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
      'platform',
      'external_trip_id',
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
    buildFilters: async (query, ctx) => buildTripListFilters(query, ctx),
    transformItem: (item) => transformTripListItem(item as Record<string, unknown>),
  },
  hooks: {
    afterList: async (payload, ctx) => {
      try {
        await enrichTripListItemsWithReceiptOcr(payload.items ?? [], ctx)
      } catch {
        // OCR enrichment is optional for list display; never block revenue summary.
      }
      await attachFilteredRevenueSummary(payload, ctx)
    },
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
  teamMemberId: z.string().uuid().nullable().optional(),
  tripType: z.string(),
  status: z.string(),
  platform: z.string().nullable().optional(),
  paymentType: z.string().nullable().optional(),
  customerPersonId: z.string().uuid().nullable().optional(),
  customerCompanyId: z.string().uuid().nullable().optional(),
  resourceId: z.string().uuid().nullable().optional(),
  ocrStatus: z.string().nullable().optional(),
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
