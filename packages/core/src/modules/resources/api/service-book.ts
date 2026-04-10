import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { resolveCrudRecordId, parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { ResourcesResourceServiceBookEntry } from '../data/entities'
import {
  resourcesResourceServiceBookEntryCreateSchema,
  resourcesResourceServiceBookEntryUpdateSchema,
} from '../data/validators'
import { E } from '#generated/entities.ids.generated'
import { createResourcesCrudOpenApi, createPagedListResponseSchema, defaultOkResponseSchema } from './openapi'

const rawBodySchema = z.object({}).passthrough()

const queryEmptyToUndefined = (value: unknown) =>
  value === '' || value === null || value === undefined ? undefined : value

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    entityId: z.string().uuid().optional(),
    sortField: z.preprocess(
      queryEmptyToUndefined,
      z.string().optional().default('serviceInAt'),
    ),
    sortDir: z.preprocess(queryEmptyToUndefined, z.enum(['asc', 'desc']).optional().default('desc')),
    filterServiceType: z.string().optional(),
    filterServiceActivity: z.string().optional(),
    filterServiceInFrom: z.string().optional(),
    filterServiceInTo: z.string().optional(),
    filterServiceOutFrom: z.string().optional(),
    filterServiceOutTo: z.string().optional(),
  })
  .passthrough()

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['resources.view'] },
  POST: { requireAuth: true, requireFeatures: ['resources.manage_resources'] },
  PUT: { requireAuth: true, requireFeatures: ['resources.manage_resources'] },
  DELETE: { requireAuth: true, requireFeatures: ['resources.manage_resources'] },
}

export const metadata = routeMetadata

function toIsoString(value: unknown): string | null {
  if (value == null) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed.length) return null
    const date = new Date(trimmed)
    return Number.isNaN(date.getTime()) ? trimmed : date.toISOString()
  }
  return null
}

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: ResourcesResourceServiceBookEntry,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
  },
  indexer: {
    entityType: E.resources.resources_resource_service_book_entry,
  },
  list: {
    schema: listSchema,
    entityId: E.resources.resources_resource_service_book_entry,
    fields: [
      'id',
      'resource_id',
      'service_type',
      'service_activity',
      'service_in_at',
      'service_out_at',
      'description',
      'organization_id',
      'tenant_id',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      serviceInAt: 'service_in_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      if (query.entityId) filters.resource_id = { $eq: query.entityId }
      if (typeof query.filterServiceType === 'string' && query.filterServiceType.trim().length) {
        filters.service_type = { $eq: query.filterServiceType.trim() }
      }
      if (typeof query.filterServiceActivity === 'string' && query.filterServiceActivity.trim().length) {
        filters.service_activity = { $eq: query.filterServiceActivity.trim() }
      }
      const inRange: Record<string, unknown> = {}
      if (typeof query.filterServiceInFrom === 'string' && query.filterServiceInFrom.trim().length) {
        const from = new Date(query.filterServiceInFrom)
        if (!Number.isNaN(from.getTime())) inRange.$gte = from
      }
      if (typeof query.filterServiceInTo === 'string' && query.filterServiceInTo.trim().length) {
        const to = new Date(query.filterServiceInTo)
        if (!Number.isNaN(to.getTime())) inRange.$lte = to
      }
      if (Object.keys(inRange).length) filters.service_in_at = inRange

      const outRange: Record<string, unknown> = {}
      if (typeof query.filterServiceOutFrom === 'string' && query.filterServiceOutFrom.trim().length) {
        const from = new Date(query.filterServiceOutFrom)
        if (!Number.isNaN(from.getTime())) outRange.$gte = from
      }
      if (typeof query.filterServiceOutTo === 'string' && query.filterServiceOutTo.trim().length) {
        const to = new Date(query.filterServiceOutTo)
        if (!Number.isNaN(to.getTime())) outRange.$lte = to
      }
      if (Object.keys(outRange).length) filters.service_out_at = outRange

      return filters
    },
    transformItem: (item: Record<string, unknown>) => {
      const record = (item ?? {}) as Record<string, unknown>
      const readString = (value: unknown): string | null => (typeof value === 'string' ? value : null)
      const idValue = readString(record.id) ?? (record.id != null ? String(record.id) : '')
      const resourceId =
        readString(record.resource_id) ?? readString(record.resourceId) ?? null
      const serviceType =
        readString(record.service_type) ?? readString(record.serviceType) ?? ''
      const serviceActivity =
        readString(record.service_activity) ?? readString(record.serviceActivity) ?? ''
      const description =
        readString(record.description) ?? (record.description == null ? null : String(record.description))
      const organizationId =
        readString(record.organization_id) ?? readString(record.organizationId)
      const tenantId = readString(record.tenant_id) ?? readString(record.tenantId)
      return {
        id: idValue,
        entityId: resourceId,
        resourceId,
        serviceType,
        serviceActivity,
        serviceInAt: toIsoString(record.service_in_at ?? record.serviceInAt),
        serviceOutAt: toIsoString(record.service_out_at ?? record.serviceOutAt),
        description,
        organizationId,
        tenantId,
        createdAt: toIsoString(record.created_at ?? record.createdAt),
        updatedAt: toIsoString(record.updated_at ?? record.updatedAt),
      }
    },
  },
  actions: {
    create: {
      commandId: 'resources.resource-service-book.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(resourcesResourceServiceBookEntryCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({
        id: result?.serviceBookEntryId ?? result?.id ?? null,
      }),
      status: 201,
    },
    update: {
      commandId: 'resources.resource-service-book.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(resourcesResourceServiceBookEntryUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'resources.resource-service-book.delete',
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

const listItemSchema = z
  .object({
    id: z.string().uuid(),
    entityId: z.string().uuid().nullable().optional(),
    resourceId: z.string().uuid().nullable().optional(),
    serviceType: z.string(),
    serviceActivity: z.string(),
    serviceInAt: z.string().nullable(),
    serviceOutAt: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    organizationId: z.string().uuid().nullable().optional(),
    tenantId: z.string().uuid().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  })
  .passthrough()

const createResponseSchema = z.object({
  id: z.string().uuid().nullable(),
})

export const openApi = createResourcesCrudOpenApi({
  resourceName: 'ResourceServiceBookEntry',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(listItemSchema),
  create: {
    schema: resourcesResourceServiceBookEntryCreateSchema,
    responseSchema: createResponseSchema,
    description: 'Adds a service book entry for a resource.',
  },
  update: {
    schema: resourcesResourceServiceBookEntryUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a resource service book entry.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Deletes a resource service book entry.',
  },
})
