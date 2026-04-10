import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { CatalogServiceLine } from '../../data/entities'
import { serviceLineCreateSchema, serviceLineUpdateSchema } from '../../data/validators'
import { parseScopedCommandInput, resolveCrudRecordId } from '../utils'
import { parseBooleanFlag, sanitizeSearchTerm } from '../helpers'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import { E } from '#generated/entities.ids.generated'
import * as F from '#generated/entities/catalog_service_line'
import {
  createCatalogCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '../openapi'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['catalog.serviceLines.view'] },
  POST: { requireAuth: true, requireFeatures: ['catalog.settings.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['catalog.settings.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['catalog.settings.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    search: z.string().optional(),
    isActive: z.string().optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .passthrough()

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: CatalogServiceLine,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  list: {
    schema: listSchema,
    entityId: E.catalog.catalog_service_line,
    fields: [
      F.id,
      F.organization_id,
      F.tenant_id,
      F.code,
      F.title,
      F.description,
      F.sort_order,
      F.is_active,
      F.created_at,
      F.updated_at,
    ],
    sortFieldMap: {
      code: F.code,
      title: F.title,
      sortOrder: F.sort_order,
      createdAt: F.created_at,
      updatedAt: F.updated_at,
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      const term = sanitizeSearchTerm(query.search)
      if (term) {
        const like = `%${escapeLikePattern(term)}%`
        filters.$or = [{ [F.code]: { $ilike: like } }, { [F.title]: { $ilike: like } }]
      }
      const isActive = parseBooleanFlag(query.isActive)
      if (isActive !== undefined) {
        filters[F.is_active] = isActive
      }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'catalog.serviceLines.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(serviceLineCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: result?.serviceLineId ?? null }),
      status: 201,
    },
    update: {
      commandId: 'catalog.serviceLines.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(serviceLineUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'catalog.serviceLines.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => {
        const { translate } = await resolveTranslations()
        const id = resolveCrudRecordId(parsed, ctx, translate)
        if (!id) throw new CrudHttpError(400, { error: translate('catalog.errors.id_required', 'Service line id is required.') })
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

const serviceLineListItemSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid().nullable().optional(),
  tenant_id: z.string().uuid().nullable().optional(),
  code: z.string(),
  title: z.string(),
  description: z.string().nullable().optional(),
  sort_order: z.coerce.number().nullable().optional(),
  is_active: z.boolean().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
})

export const openApi = createCatalogCrudOpenApi({
  resourceName: 'Service Line',
  pluralName: 'Service Lines',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(serviceLineListItemSchema),
  create: {
    schema: serviceLineCreateSchema,
    description: 'Creates a service line used to classify catalog products (e.g. financing, insurance).',
  },
  update: {
    schema: serviceLineUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates an existing service line by id.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Deletes a service line by id.',
  },
})
