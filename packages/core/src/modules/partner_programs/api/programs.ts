import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { resolveCrudRecordId, parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import { parseBooleanToken } from '@open-mercato/shared/lib/boolean'
import { PartnerProgram } from '../data/entities'
import { partnerProgramCreateSchema, partnerProgramUpdateSchema } from '../data/validators'
import { E } from '#generated/entities.ids.generated'
import {
  createPartnerProgramsCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from './openapi'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['partner_programs.view'] },
  POST: { requireAuth: true, requireFeatures: ['partner_programs.create'] },
  PUT: { requireAuth: true, requireFeatures: ['partner_programs.edit'] },
  DELETE: { requireAuth: true, requireFeatures: ['partner_programs.delete'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    ids: z.string().optional(),
    search: z.string().optional(),
    isActive: z.string().optional(),
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
    entity: PartnerProgram,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: E.partner_programs.partner_program },
  list: {
    schema: listSchema,
    entityId: E.partner_programs.partner_program,
    fields: [
      'id',
      'organization_id',
      'tenant_id',
      'name',
      'description',
      'valid_from',
      'valid_to',
      'is_active',
      'metadata',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      name: 'name',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      validFrom: 'valid_from',
      validTo: 'valid_to',
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      const ids = parseIds(query.ids)
      if (ids.length) {
        filters.id = { $in: ids }
      }
      if (query.search) {
        const term = query.search.trim()
        if (term.length) {
          const like = `%${escapeLikePattern(term)}%`
          filters.$or = [{ name: { $ilike: like } }, { description: { $ilike: like } }]
        }
      }
      const activeTok = typeof query.isActive === 'string' ? query.isActive.trim() : ''
      if (activeTok) {
        const parsedActive = parseBooleanToken(activeTok)
        if (parsedActive !== undefined) {
          filters.is_active = parsedActive
        }
      }
      return filters
    },
  },
  actions: {
    create: {
      commandId: 'partner_programs.programs.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(partnerProgramCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: (result as { programId: string }).programId }),
      status: 201,
    },
    update: {
      commandId: 'partner_programs.programs.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(partnerProgramUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'partner_programs.programs.delete',
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

const programRowSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  tenantId: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  isActive: z.boolean(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
})

export const openApi = createPartnerProgramsCrudOpenApi({
  resourceName: 'Partner program',
  pluralName: 'Partner programs',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(programRowSchema),
  create: {
    schema: partnerProgramCreateSchema,
    description: 'Creates a partner program for the current organization.',
  },
  update: {
    schema: partnerProgramUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a partner program.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a partner program.',
  },
})
