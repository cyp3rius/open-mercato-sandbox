import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { resolveCrudRecordId, parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import {
  TaxiFleetDriverCommunication,
  TaxiFleetDriverCommunicationRecipient,
} from '../data/entities'
import {
  driverCommunicationCreateSchema,
  driverCommunicationUpdateSchema,
} from '../data/validators'
import {
  createTaxiFleetCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from './openapi'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_driver_communications'] },
  POST: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_driver_communications'] },
  PUT: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_driver_communications'] },
  DELETE: { requireAuth: true, requireFeatures: ['taxi_fleet.manage_driver_communications'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
    ids: z.string().optional(),
    search: z.string().optional(),
    status: z.string().optional(),
    kind: z.string().optional(),
    sentFrom: z.string().optional(),
    sentTo: z.string().optional(),
    createdFrom: z.string().optional(),
    createdTo: z.string().optional(),
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

function parseDateBound(value: string | undefined, endOfDay: boolean): Date | null {
  if (!value?.trim()) return null
  const raw = value.trim()
  const hasTime = raw.includes('T')
  const iso = hasTime ? raw : `${raw}${endOfDay ? 'T23:59:59.999' : 'T00:00:00.000'}`
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

async function attachRecipientCounts(
  em: EntityManager,
  items: Array<Record<string, unknown>>,
): Promise<void> {
  const ids = items
    .map((item) => (typeof item.id === 'string' ? item.id : null))
    .filter((id): id is string => Boolean(id))
  if (!ids.length) return

  const recipients = await em.find(TaxiFleetDriverCommunicationRecipient, {
    communicationId: { $in: ids },
  })
  const counts = new Map<
    string,
    { total: number; sent: number; read: number; failed: number; skipped: number; pending: number }
  >()
  for (const id of ids) {
    counts.set(id, { total: 0, sent: 0, read: 0, failed: 0, skipped: 0, pending: 0 })
  }
  for (const row of recipients) {
    const bucket = counts.get(row.communicationId)
    if (!bucket) continue
    bucket.total += 1
    if (row.deliveryStatus === 'sent') bucket.sent += 1
    else if (row.deliveryStatus === 'failed') bucket.failed += 1
    else if (row.deliveryStatus === 'skipped') bucket.skipped += 1
    else bucket.pending += 1
    if (row.readAt) bucket.read += 1
  }
  for (const item of items) {
    const id = typeof item.id === 'string' ? item.id : null
    if (!id) continue
    item.recipientCounts = counts.get(id) ?? {
      total: 0,
      sent: 0,
      read: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
    }
  }
}

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: TaxiFleetDriverCommunication,
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
      'kind',
      'title',
      'body',
      'status',
      'scheduled_at',
      'sent_at',
      'created_by_user_id',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      scheduledAt: 'scheduled_at',
      sentAt: 'sent_at',
      status: 'status',
      kind: 'kind',
      title: 'title',
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      const ids = parseIds(query.ids)
      if (ids.length) filters.id = { $in: ids }

      const search = typeof query.search === 'string' ? query.search.trim() : ''
      if (search) {
        filters.$or = [
          { title: { $ilike: `%${escapeLikePattern(search)}%` } },
          { body: { $ilike: `%${escapeLikePattern(search)}%` } },
        ]
      }

      const statuses = parseIds(typeof query.status === 'string' ? query.status : undefined)
      if (statuses.length === 1) filters.status = statuses[0]
      else if (statuses.length > 1) filters.status = { $in: statuses }

      const kinds = parseIds(typeof query.kind === 'string' ? query.kind : undefined)
      if (kinds.length === 1) filters.kind = kinds[0]
      else if (kinds.length > 1) filters.kind = { $in: kinds }

      const sentFrom = parseDateBound(query.sentFrom, false)
      const sentTo = parseDateBound(query.sentTo, true)
      if (sentFrom || sentTo) {
        filters.sent_at = {
          ...(sentFrom ? { $gte: sentFrom } : {}),
          ...(sentTo ? { $lte: sentTo } : {}),
        }
      }

      const createdFrom = parseDateBound(query.createdFrom, false)
      const createdTo = parseDateBound(query.createdTo, true)
      if (createdFrom || createdTo) {
        filters.created_at = {
          ...(createdFrom ? { $gte: createdFrom } : {}),
          ...(createdTo ? { $lte: createdTo } : {}),
        }
      }

      return filters
    },
  },
  hooks: {
    afterList: async (payload, ctx) => {
      const em = ctx.container.resolve('em') as EntityManager
      if (Array.isArray(payload.items)) {
        await attachRecipientCounts(em, payload.items as Array<Record<string, unknown>>)
      }
    },
  },
  actions: {
    create: {
      commandId: 'taxi_fleet.driver_communications.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(driverCommunicationCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: (result as { communicationId: string }).communicationId }),
      status: 201,
    },
    update: {
      commandId: 'taxi_fleet.driver_communications.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(driverCommunicationUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'taxi_fleet.driver_communications.delete',
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
  kind: z.string(),
  title: z.string(),
  status: z.string(),
})

export const openApi = createTaxiFleetCrudOpenApi({
  resourceName: 'Driver communication',
  pluralName: 'Driver communications',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(rowSchema),
  create: {
    schema: driverCommunicationCreateSchema,
    description: 'Creates a driver broadcast communication.',
  },
  update: { schema: driverCommunicationUpdateSchema, responseSchema: defaultOkResponseSchema },
  del: { schema: z.object({ id: z.string().uuid() }), responseSchema: defaultOkResponseSchema },
})
