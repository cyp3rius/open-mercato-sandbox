import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { parseScopedCommandInput, resolveCrudRecordId } from '@open-mercato/shared/lib/api/scoped'
import { parseBooleanToken } from '@open-mercato/shared/lib/boolean'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import { TaxiFleetDiscountCode } from '../data/entities'
import {
  discountCodeCreateSchema,
  discountCodeListQuerySchema,
  discountCodeUpdateSchema,
} from '../data/validators'
import {
  createTaxiFleetCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from './openapi'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.view'] },
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_trips'] },
  PUT: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_trips'] },
  DELETE: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_trips'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: TaxiFleetDiscountCode,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  list: {
    schema: discountCodeListQuerySchema,
    fields: [
      'id',
      'organization_id',
      'tenant_id',
      'code',
      'label',
      'discount_type',
      'value',
      'usage_limit',
      'used_amount',
      'active',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      code: 'code',
      active: 'active',
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.ids) {
        const ids = query.ids
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
        if (ids.length) filters.id = { $in: ids }
      }
      const search = typeof query.search === 'string' ? query.search.trim() : ''
      if (search) {
        const pattern = `%${escapeLikePattern(search.toUpperCase())}%`
        filters.$or = [{ code: { $ilike: pattern } }, { label: { $ilike: pattern } }]
      }
      const active = parseBooleanToken(query.active)
      if (active !== null) filters.active = active
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'taxi_fleet.discount_codes.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(discountCodeCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: (result as { discountCodeId: string }).discountCodeId }),
      status: 201,
    },
    update: {
      commandId: 'taxi_fleet.discount_codes.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(discountCodeUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'taxi_fleet.discount_codes.delete',
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
  code: z.string(),
  label: z.string().nullable().optional(),
  discountType: z.enum(['percent', 'amount']),
  value: z.string(),
  usageLimit: z.string().nullable().optional(),
  usedAmount: z.string().optional(),
  active: z.boolean(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const openApi = createTaxiFleetCrudOpenApi({
  resourceName: 'Discount code',
  pluralName: 'Discount codes',
  querySchema: discountCodeListQuerySchema,
  listResponseSchema: createPagedListResponseSchema(rowSchema),
  create: { schema: discountCodeCreateSchema },
  update: { schema: discountCodeUpdateSchema, responseSchema: defaultOkResponseSchema },
  del: { schema: z.object({ id: z.string().uuid() }), responseSchema: defaultOkResponseSchema },
})
