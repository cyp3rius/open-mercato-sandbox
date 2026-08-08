import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { resolveCrudRecordId, parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { TaxiFleetDriverProfile } from '../data/entities'
import { driverProfileCreateSchema, driverProfileUpdateSchema } from '../data/validators'
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
    pageSize: z.coerce.number().min(1).max(100).default(50),
    ids: z.string().optional(),
    teamMemberId: z.string().uuid().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: TaxiFleetDriverProfile,
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
      'payout_percent',
      'default_resource_id',
      'external_app_enabled',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: { createdAt: 'created_at', updatedAt: 'updated_at' },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.ids) {
        const ids = query.ids.split(',').map((item) => item.trim()).filter(Boolean)
        if (ids.length) filters.id = { $in: ids }
      }
      if (query.teamMemberId) filters.team_member_id = query.teamMemberId
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'taxi_fleet.driver_profiles.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(driverProfileCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: (result as { profileId: string }).profileId }),
      status: 201,
    },
    update: {
      commandId: 'taxi_fleet.driver_profiles.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(driverProfileUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'taxi_fleet.driver_profiles.delete',
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
  payoutPercent: z.string(),
  externalAppEnabled: z.boolean(),
})

export const openApi = createTaxiFleetCrudOpenApi({
  resourceName: 'Driver profile',
  pluralName: 'Driver profiles',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(rowSchema),
  create: { schema: driverProfileCreateSchema },
  update: { schema: driverProfileUpdateSchema, responseSchema: defaultOkResponseSchema },
  del: { schema: z.object({ id: z.string().uuid() }), responseSchema: defaultOkResponseSchema },
})
