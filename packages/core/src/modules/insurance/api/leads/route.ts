import { NextResponse } from 'next/server'
import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { InsuranceLead } from '../../data/entities'
import { insuranceLeadCreateSchema, insuranceLeadUpdateSchema } from '../../data/validators'
import {
  buildInsuranceCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '../openapi'
import { mergeInsuranceCommandScope } from '../mergeScope'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['insurance.leads.view'] },
  POST: { requireAuth: true, requireFeatures: ['insurance.leads.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['insurance.leads.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['insurance.leads.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).loose()
type CrudInput = Record<string, unknown>

const crud = makeCrudRoute<CrudInput, CrudInput, Record<string, unknown>>({
  metadata: routeMetadata,
  orm: {
    entity: InsuranceLead,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: {
    module: 'insurance',
    entity: 'lead',
    persistent: true,
  },
  actions: {
    create: {
      commandId: 'insurance.leads.create',
      schema: rawBodySchema,
      mapInput: ({ parsed, ctx }) => mergeInsuranceCommandScope(parsed as Record<string, unknown>, ctx),
      response: ({ result }) => ({ id: String(result.leadId) }),
      status: 201,
    },
    update: {
      commandId: 'insurance.leads.update',
      schema: rawBodySchema,
      mapInput: ({ parsed, ctx }) => mergeInsuranceCommandScope(parsed as Record<string, unknown>, ctx),
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'insurance.leads.delete',
      schema: rawBodySchema,
      mapInput: ({ raw, ctx }) => ({
        id: ((raw as Record<string, unknown>).query as Record<string, unknown> | undefined)?.id as
          | string
          | undefined,
        organizationId: ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? undefined,
        tenantId: ctx.auth?.tenantId ?? undefined,
      }),
      response: () => ({ ok: true }),
    },
  },
})

const listQuerySchema = z
  .object({
    id: z.uuid().optional(),
    status: z.string().optional(),
    source: z.string().optional(),
    externalId: z.string().optional(),
    /** When true, only leads with no linked policy (`linked_policy_id` is null). */
    unlinkedOnly: z.coerce.boolean().optional(),
    /** Filter by linked policy id (exact match). */
    linkedPolicyId: z.uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    search: z.string().optional(),
    sortField: z.enum(['title', 'status', 'createdAt', 'updatedAt']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .loose()

type LeadRow = {
  id: string
  title: string
  status: string
  source: string | null
  externalId: string | null
  payload: Record<string, unknown> | null
  referringPartnerEntityId: string | null
  linkedPolicyId: string | null
  createdAt: string | null
  updatedAt: string | null
  organizationId: string
  tenantId: string
}

const toRow = (row: InsuranceLead): LeadRow => {
  const lp = row.linkedPolicy
  const linkedPolicyId =
    lp === null || lp === undefined ? null : typeof lp === 'string' ? lp : lp.id
  return {
    id: String(row.id),
    title: row.title,
    status: row.status,
    source: row.source ?? null,
    externalId: row.externalId ?? null,
    payload: row.payload ? { ...row.payload } : null,
    referringPartnerEntityId: row.referringPartnerEntityId ?? null,
    linkedPolicyId,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    organizationId: String(row.organizationId),
    tenantId: String(row.tenantId),
  }
}

export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req)
  if (!auth?.sub) {
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }, { status: 401 })
  }

  const url = new URL(req.url)
  const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }, { status: 400 })
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })

  const tenantId = scope.tenantId ?? auth.tenantId ?? null
  if (!tenantId) {
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }, { status: 401 })
  }

  const allowedOrgIds: string[] = []
  if (Array.isArray(scope.filterIds) && scope.filterIds.length > 0) {
    allowedOrgIds.push(...scope.filterIds)
  } else if (Array.isArray(scope.allowedIds) && scope.allowedIds.length > 0) {
    allowedOrgIds.push(...scope.allowedIds)
  } else if (auth.orgId) {
    allowedOrgIds.push(auth.orgId)
  }

  const { id, status, source, externalId, unlinkedOnly, linkedPolicyId, page, pageSize, search, sortField, sortDir } =
    parsed.data
  const filter: FilterQuery<InsuranceLead> = {
    tenantId,
    deletedAt: null,
  }
  if (allowedOrgIds.length > 0) {
    filter.organizationId = { $in: [...new Set(allowedOrgIds)] }
  } else if (auth.isSuperAdmin !== true) {
    return NextResponse.json({ items: [], total: 0, page, pageSize, totalPages: 1 })
  }

  if (id) filter.id = id
  if (status) filter.status = status
  if (source) filter.source = source
  if (externalId) filter.externalId = externalId
  if (linkedPolicyId) {
    filter.linkedPolicy = linkedPolicyId
  } else if (unlinkedOnly) {
    filter.linkedPolicy = null
  }
  if (search) {
    const searchClause = {
      $or: [{ title: { $ilike: `%${search}%` } }, { externalId: { $ilike: `%${search}%` } }],
    }
    const existingAnd = filter.$and
    filter.$and = [...(Array.isArray(existingAnd) ? existingAnd : []), searchClause]
  }

  const fieldMap: Record<string, string> = {
    title: 'title',
    status: 'status',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  }
  const orderBy: Record<string, 'ASC' | 'DESC'> = {}
  if (sortField) {
    const mapped = fieldMap[sortField] || 'createdAt'
    orderBy[mapped] = sortDir === 'desc' ? 'DESC' : 'ASC'
  } else {
    orderBy.createdAt = 'DESC'
  }

  const [all, total] = await em.findAndCount(InsuranceLead, filter, {
    orderBy,
    populate: ['linkedPolicy'],
  })
  const start = (page - 1) * pageSize
  const paged = all.slice(start, start + pageSize)
  const items = paged.map(toRow)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return NextResponse.json({ items, total, page, pageSize, totalPages })
}

export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const leadListItemSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  status: z.string(),
  source: z.string().nullable(),
  externalId: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()).nullable(),
  referringPartnerEntityId: z.uuid().nullable(),
  linkedPolicyId: z.uuid().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  organizationId: z.uuid(),
  tenantId: z.uuid(),
})

export const openApi = buildInsuranceCrudOpenApi({
  resourceName: 'Lead',
  pluralName: 'Leads',
  querySchema: listQuerySchema,
  listResponseSchema: createPagedListResponseSchema(leadListItemSchema),
  create: {
    schema: insuranceLeadCreateSchema,
    description: 'Creates an insurance lead / inquiry record (ingestible from external APIs).',
  },
  update: {
    schema: insuranceLeadUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a lead.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a lead.',
  },
})
