import { z } from 'zod'
import type { FilterQuery } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/postgresql'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { resolveCrudRecordId, parseScopedCommandInput } from '@open-mercato/shared/lib/api/scoped'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import { Playbook } from '../../playbooks/data/entities'
import { CustomerEntity } from '../../customers/data/entities'
import { ServiceCase } from '../data/entities'
import { formatProcedurePlaybookLabel } from '../lib/formatProcedurePlaybookLabel'
import { readCasePlaybookRun } from '../lib/casePlaybookMetadata'
import { caseCreateSchema, caseUpdateSchema } from '../data/validators'
import { E } from '#generated/entities.ids.generated'
import { createCasesCrudOpenApi, createPagedListResponseSchema, defaultOkResponseSchema } from './openapi'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['cases.view'] },
  POST: { requireAuth: true, requireFeatures: ['cases.create'] },
  PUT: { requireAuth: true, requireFeatures: ['cases.edit'] },
  DELETE: { requireAuth: true, requireFeatures: ['cases.delete'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const listSchema = z
  .object({
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    ids: z.string().optional(),
    search: z.string().optional(),
    statusValue: z.string().optional(),
    ownerUserId: z.string().uuid().optional(),
    customerEntityId: z.string().uuid().optional(),
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

function optStr(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return v
  return null
}

function uuidOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = typeof v === 'string' ? v.trim() : ''
  return s.length ? s : null
}

function toIsoNullable(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return v
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'number' && Number.isFinite(v)) return new Date(v).toISOString()
  return null
}

/** Query engine rows use SQL column aliases (snake_case); clients expect camelCase like ORM entities. */
function transformCaseListItem(item: Record<string, unknown> | null | undefined) {
  if (!item) return item
  const r = item
  const first = (snake: string, camel: string) => (r[snake] !== undefined ? r[snake] : r[camel])

  return {
    id: String(first('id', 'id') ?? ''),
    organizationId: String(first('organization_id', 'organizationId') ?? ''),
    tenantId: String(first('tenant_id', 'tenantId') ?? ''),
    title: typeof first('title', 'title') === 'string' ? String(first('title', 'title')) : '',
    statusValue:
      typeof first('status_value', 'statusValue') === 'string'
        ? String(first('status_value', 'statusValue'))
        : '',
    statusLabel: optStr(first('status_label', 'statusLabel')),
    statusColor: optStr(first('status_color', 'statusColor')),
    customerEntityId: uuidOrNull(first('customer_entity_id', 'customerEntityId')),
    resourceId: uuidOrNull(first('resource_id', 'resourceId')),
    procurementProcessId: uuidOrNull(first('procurement_process_id', 'procurementProcessId')),
    insurancePolicyId: uuidOrNull(first('insurance_policy_id', 'insurancePolicyId')),
    ownerUserId: uuidOrNull(first('owner_user_id', 'ownerUserId')),
    openedAt: toIsoNullable(first('opened_at', 'openedAt')),
    closedAt: toIsoNullable(first('closed_at', 'closedAt')),
    priority: typeof first('priority', 'priority') === 'string' ? String(first('priority', 'priority')) : 'normal',
    metadata:
      first('metadata', 'metadata') && typeof first('metadata', 'metadata') === 'object'
        ? (first('metadata', 'metadata') as Record<string, unknown>)
        : null,
    createdAt: toIsoNullable(first('created_at', 'createdAt')),
    updatedAt: toIsoNullable(first('updated_at', 'updatedAt')),
  }
}

const crud = makeCrudRoute({
  metadata: routeMetadata,
  orm: {
    entity: ServiceCase,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: E.cases.service_case },
  list: {
    schema: listSchema,
    entityId: E.cases.service_case,
    fields: [
      'id',
      'organization_id',
      'tenant_id',
      'title',
      'status_value',
      'status_label',
      'status_color',
      'customer_entity_id',
      'resource_id',
      'procurement_process_id',
      'insurance_policy_id',
      'owner_user_id',
      'opened_at',
      'closed_at',
      'priority',
      'metadata',
      'created_at',
      'updated_at',
    ],
    sortFieldMap: {
      title: 'title',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      openedAt: 'opened_at',
      closedAt: 'closed_at',
      statusValue: 'status_value',
    },
    buildFilters: async (query) => {
      const filters: Record<string, unknown> = {}
      const ids = parseIds(query.ids)
      if (ids.length) {
        filters.id = { $in: ids }
      }
      if (typeof query.statusValue === 'string' && query.statusValue.trim().length) {
        filters.status_value = query.statusValue.trim()
      }
      if (typeof query.ownerUserId === 'string' && query.ownerUserId.length) {
        filters.owner_user_id = query.ownerUserId
      }
      if (typeof query.customerEntityId === 'string' && query.customerEntityId.length) {
        filters.customer_entity_id = query.customerEntityId
      }
      if (query.search) {
        const term = query.search.trim()
        if (term.length) {
          const like = `%${escapeLikePattern(term)}%`
          filters.title = { $ilike: like }
        }
      }
      return filters
    },
    transformItem: (item) => transformCaseListItem(item as Record<string, unknown>),
  },
  hooks: {
    afterList: async (payload, ctx) => {
      const items = Array.isArray(payload.items) ? payload.items : []
      if (!items.length) return
      const tenantId = ctx.auth?.tenantId
      const em = ctx.container.resolve('em') as EntityManager
      const organizationId = ctx.selectedOrganizationId ?? null

      if (!tenantId) {
        for (const item of items) {
          if (item && typeof item === 'object') {
            const row = item as Record<string, unknown>
            row.customerDisplayName = null
            row.procedureDisplayLabel = null
          }
        }
        return
      }

      const customerIdSet = new Set<string>()
      for (const item of items) {
        if (!item || typeof item !== 'object') continue
        const raw = (item as Record<string, unknown>).customerEntityId
        if (typeof raw === 'string' && raw.trim().length) customerIdSet.add(raw.trim())
      }
      if (customerIdSet.size === 0) {
        for (const item of items) {
          if (item && typeof item === 'object') (item as Record<string, unknown>).customerDisplayName = null
        }
      } else {
        const customers = await findWithDecryption(
          em,
          CustomerEntity,
          { id: { $in: [...customerIdSet] }, tenantId },
          { fields: ['id', 'displayName', 'organizationId', 'tenantId'] },
          { tenantId, organizationId },
        )
        const customerById = new Map(customers.map((c) => [c.id, c.displayName]))
        for (const item of items) {
          if (!item || typeof item !== 'object') continue
          const cid = (item as Record<string, unknown>).customerEntityId
          const key = typeof cid === 'string' && cid.trim().length ? cid.trim() : ''
          ;(item as Record<string, unknown>).customerDisplayName = key ? (customerById.get(key) ?? null) : null
        }
      }

      const playbookIdSet = new Set<string>()
      for (const item of items) {
        if (!item || typeof item !== 'object') continue
        const meta = (item as Record<string, unknown>).metadata
        const run = readCasePlaybookRun(meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : null)
        const pid = run?.playbookId?.trim()
        if (pid) playbookIdSet.add(pid)
      }

      let playbookById = new Map<string, { title: string; version: number | null }>()
      let translate: Awaited<ReturnType<typeof resolveTranslations>>['translate'] | null = null
      if (playbookIdSet.size > 0) {
        const scopeOrgId = ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? null
        const where: FilterQuery<Playbook> = {
          id: { $in: [...playbookIdSet] },
          tenantId,
          deletedAt: null,
        }
        if (scopeOrgId) {
          where.organizationId = scopeOrgId
        }
        const playbooks = await em.find(Playbook, where)
        playbookById = new Map(
          playbooks.map((p) => [
            p.id,
            {
              title: typeof p.title === 'string' ? p.title : '',
              version:
                typeof p.version === 'number' && Number.isFinite(p.version) ? Math.trunc(p.version) : null,
            },
          ]),
        )
        translate = (await resolveTranslations()).translate
      }

      for (const item of items) {
        if (!item || typeof item !== 'object') continue
        const row = item as Record<string, unknown>
        const meta = row.metadata
        const run = readCasePlaybookRun(meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : null)
        const pid = run?.playbookId?.trim()
        if (!pid || !translate) {
          row.procedureDisplayLabel = null
          continue
        }
        const pb = playbookById.get(pid)
        row.procedureDisplayLabel = pb
          ? formatProcedurePlaybookLabel(pb.title, pb.version, translate)
          : null
      }
    },
  },
  actions: {
    create: {
      commandId: 'cases.cases.create',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(caseCreateSchema, raw ?? {}, ctx, translate)
      },
      response: ({ result }) => ({ id: (result as { caseId: string }).caseId }),
      status: 201,
    },
    update: {
      commandId: 'cases.cases.update',
      schema: rawBodySchema,
      mapInput: async ({ raw, ctx }) => {
        const { translate } = await resolveTranslations()
        return parseScopedCommandInput(caseUpdateSchema, raw ?? {}, ctx, translate)
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'cases.cases.delete',
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

const caseRowSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  tenantId: z.string().uuid(),
  title: z.string(),
  statusValue: z.string(),
  statusLabel: z.string().nullable(),
  statusColor: z.string().nullable(),
  customerEntityId: z.string().uuid().nullable(),
  customerDisplayName: z.string().nullable(),
  procedureDisplayLabel: z.string().nullable().optional(),
  resourceId: z.string().uuid().nullable(),
  procurementProcessId: z.string().uuid().nullable(),
  insurancePolicyId: z.string().uuid().nullable(),
  ownerUserId: z.string().uuid().nullable(),
  openedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  priority: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
})

export const openApi = createCasesCrudOpenApi({
  resourceName: 'Case',
  pluralName: 'Cases',
  querySchema: listSchema,
  listResponseSchema: createPagedListResponseSchema(caseRowSchema),
  create: {
    schema: caseCreateSchema,
    description: 'Creates a customer service case.',
  },
  update: {
    schema: caseUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a case.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a case.',
  },
})
