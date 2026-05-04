import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { resolveCrudRecordId, parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import { Playbook } from '../data/entities'
import {
  playbookCreateSchema,
  playbookDeleteSchema,
  playbookUpdateSchema,
} from '../data/validators'
import { E } from '#generated/entities.ids.generated'
import { createPlaybooksCrudOpenApi, createPagedListResponseSchema, defaultOkResponseSchema } from './openapi'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['playbooks.view'] },
  POST: { requireAuth: true, requireFeatures: ['playbooks.create'] },
  PUT: { requireAuth: true, requireFeatures: ['playbooks.edit'] },
  DELETE: { requireAuth: true, requireFeatures: ['playbooks.delete'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    ids: z.string().optional(),
    search: z.string().optional(),
    slug: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional(),
    sortField: z.string().optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .passthrough()

const parseIds = (value?: string) => {
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: Playbook,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: E.playbooks.playbook },
  list: {
    schema: listSchema,
    entityId: E.playbooks.playbook,
    fields: [
      'id',
      'organization_id',
      'tenant_id',
      'slug',
      'title',
      'body',
      'context_tags',
      'procedure_definition',
      'audience',
      'version',
      'published_at',
      'is_active',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      title: 'title',
      slug: 'slug',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      version: 'version',
      publishedAt: 'published_at',
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      const ids = parseIds(query.ids)
      if (ids.length) {
        filters.id = { $in: ids }
      }
      if (query.isActive === 'true') filters.is_active = true
      if (query.isActive === 'false') filters.is_active = false
      if (typeof query.slug === 'string' && query.slug.trim().length) {
        filters.slug = query.slug.trim().toLowerCase()
      }
      if (typeof query.search === 'string' && query.search.trim().length) {
        const term = query.search.trim()
        const like = `%${escapeLikePattern(term)}%`
        filters.title = { $ilike: like }
      }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'playbooks.playbooks.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(playbookCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: (result as { playbookId: string }).playbookId }),
      status: 201,
    },
    update: {
      commandId: 'playbooks.playbooks.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(playbookUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'playbooks.playbooks.delete',
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

const playbookRowSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  tenantId: z.string().uuid(),
  slug: z.string(),
  title: z.string(),
  body: z.string(),
  contextTags: z.array(z.string()),
  procedureDefinition: z.array(z.unknown()).optional(),
  audience: z.string(),
  version: z.number().int(),
  publishedAt: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
})

export const openApi = createPlaybooksCrudOpenApi({
  resourceName: 'Playbook',
  pluralName: 'Playbooks',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(playbookRowSchema),
  create: {
    schema: playbookCreateSchema,
    description: 'Creates a playbook.',
  },
  update: {
    schema: playbookUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a playbook.',
  },
  del: {
    schema: playbookDeleteSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a playbook.',
  },
})
