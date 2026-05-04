import { NextResponse } from 'next/server'
import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { User } from '@open-mercato/core/modules/auth/data/entities'
import { ProcurementProcess } from '../../data/entities'
import { procurementProcessCreateSchema, procurementProcessUpdateSchema } from '../../data/validators'
import {
  buildProcurementCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '../openapi'
import { parseBooleanFlag } from '@open-mercato/shared/lib/boolean'
import { mergeProcurementCommandScope } from '../mergeScope'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['procurement.processes.view'] },
  POST: { requireAuth: true, requireFeatures: ['procurement.processes.manage'] },
  PUT: {
    requireAuth: true,
    requireAnyFeatures: ['procurement.processes.manage', 'procurement.processes.handle'],
  },
  DELETE: { requireAuth: true, requireFeatures: ['procurement.processes.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).loose()
type CrudInput = Record<string, unknown>

const crud = makeCrudRoute<CrudInput, CrudInput, Record<string, unknown>>({
  metadata: routeMetadata,
  orm: {
    entity: ProcurementProcess,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: {
    module: 'procurement',
    entity: 'process',
    persistent: true,
  },
  actions: {
    create: {
      commandId: 'procurement.processes.create',
      schema: rawBodySchema,
      mapInput: ({ parsed, ctx }) => mergeProcurementCommandScope(parsed as Record<string, unknown>, ctx),
      response: ({ result }) => ({ id: String((result as { processId: string }).processId) }),
      status: 201,
    },
    update: {
      commandId: 'procurement.processes.update',
      schema: rawBodySchema,
      mapInput: ({ parsed, ctx }) => mergeProcurementCommandScope(parsed as Record<string, unknown>, ctx),
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'procurement.processes.delete',
      schema: rawBodySchema,
      mapInput: ({ raw, ctx }) => ({
        id: ((raw as Record<string, unknown>).query as Record<string, unknown> | undefined)?.id as
          | string
          | undefined,
      }),
      response: () => ({ ok: true }),
    },
  },
})

const listQuerySchema = z
  .object({
    id: z.uuid().optional(),
    customerEntityId: z.uuid().optional(),
    /** When `true`, only processes with no linked customer. Ignores `customerEntityId`. */
    customerUnassigned: z.string().optional(),
    resourceId: z.uuid().optional(),
    salesQuoteId: z.uuid().optional(),
    statusValue: z.string().optional(),
    typeValue: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    search: z.string().optional(),
    sortField: z.enum(['title', 'createdAt', 'updatedAt', 'startedAt', 'closedAt']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .loose()

type ProcessRow = {
  id: string
  title: string
  description: string | null
  startedAt: string | null
  statusValue: string | null
  statusLabel: string | null
  statusColor: string | null
  statusIcon: string | null
  typeValue: string | null
  typeLabel: string | null
  typeColor: string | null
  typeIcon: string | null
  customerEntityId: string | null
  salesQuoteId: string | null
  salesInvoiceId: string | null
  resourceId: string | null
  selectedSupplierId: string | null
  refinancingLineItemId: string | null
  refinancingEnabled: boolean
  refinancingNotes: string | null
  closedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  organizationId: string
  tenantId: string
  handlerUserId: string | null
  handlerLabel: string | null
}

function formatUserHandlerLabel(user: User): string {
  const name = typeof user.name === 'string' && user.name.trim().length ? user.name.trim() : ''
  if (name) return name
  const email = typeof user.email === 'string' && user.email.trim().length ? user.email.trim() : ''
  if (email) return email
  return String(user.id)
}

const toRow = (row: ProcurementProcess, handlerLabel: string | null): ProcessRow => ({
  id: String(row.id),
  title: row.title,
  description: row.description ?? null,
  startedAt: row.startedAt ? row.startedAt.toISOString() : null,
  statusValue: row.statusValue ?? null,
  statusLabel: row.statusLabel ?? null,
  statusColor: row.statusColor ?? null,
  statusIcon: row.statusIcon ?? null,
  typeValue: row.typeValue ?? null,
  typeLabel: row.typeLabel ?? null,
  typeColor: row.typeColor ?? null,
  typeIcon: row.typeIcon ?? null,
  customerEntityId: row.customerEntityId ?? null,
  salesQuoteId: row.salesQuoteId ?? null,
  salesInvoiceId: row.salesInvoiceId ?? null,
  resourceId: row.resourceId ?? null,
  selectedSupplierId: row.selectedSupplierId ?? null,
  refinancingLineItemId: row.refinancingLineItemId ?? null,
  refinancingEnabled: Boolean(row.refinancingEnabled),
  refinancingNotes: row.refinancingNotes ?? null,
  closedAt: row.closedAt ? row.closedAt.toISOString() : null,
  createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  organizationId: String(row.organizationId),
  tenantId: String(row.tenantId),
  handlerUserId: row.handlerUserId ?? null,
  handlerLabel,
})

export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req)
  if (!auth || !auth.tenantId || (!auth.orgId && !auth.isSuperAdmin)) {
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }, { status: 401 })
  }

  const url = new URL(req.url)
  const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) {
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize: 50, totalPages: 1 }, { status: 400 })
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager

  const {
    id,
    customerEntityId,
    customerUnassigned: customerUnassignedRaw,
    resourceId,
    salesQuoteId,
    statusValue,
    typeValue,
    page,
    pageSize,
    search,
    sortField,
    sortDir,
  } = parsed.data
  const customerUnassigned = parseBooleanFlag(
    typeof customerUnassignedRaw === 'string' ? customerUnassignedRaw : undefined,
  )
  const filter: FilterQuery<ProcurementProcess> = {
    tenantId: auth.tenantId,
    deletedAt: null,
  }
  if (auth.orgId) {
    filter.organizationId = auth.orgId
  }

  if (id) filter.id = id
  if (customerUnassigned === true) {
    filter.customerEntityId = null
  } else if (customerEntityId) {
    filter.customerEntityId = customerEntityId
  }
  if (resourceId) filter.resourceId = resourceId
  if (salesQuoteId) filter.salesQuoteId = salesQuoteId
  const statusFilter = typeof statusValue === 'string' ? statusValue.trim() : ''
  if (statusFilter) filter.statusValue = statusFilter
  const typeFilter = typeof typeValue === 'string' ? typeValue.trim() : ''
  if (typeFilter) filter.typeValue = typeFilter
  if (search) {
    filter.title = { $ilike: `%${search}%` }
  }

  const fieldMap: Record<string, string> = {
    title: 'title',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    startedAt: 'startedAt',
    closedAt: 'closedAt',
  }
  const orderBy: Record<string, 'ASC' | 'DESC'> = {}
  if (sortField) {
    const mapped = fieldMap[sortField] || 'updatedAt'
    orderBy[mapped] = sortDir === 'desc' ? 'DESC' : 'ASC'
  } else {
    orderBy.updatedAt = 'DESC'
  }

  const [all, total] = await em.findAndCount(ProcurementProcess, filter, {
    orderBy,
  })
  const start = (page - 1) * pageSize
  const paged = all.slice(start, start + pageSize)
  const handlerIds = [...new Set(paged.map((r) => r.handlerUserId).filter(Boolean) as string[])]
  const handlers =
    handlerIds.length > 0
      ? await em.find(User, { id: { $in: handlerIds }, deletedAt: null })
      : []
  const handlerLabelById = new Map(handlers.map((u) => [u.id, formatUserHandlerLabel(u)] as const))
  const items = paged.map((row) => toRow(row, row.handlerUserId ? handlerLabelById.get(row.handlerUserId) ?? null : null))
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return NextResponse.json({ items, total, page, pageSize, totalPages })
}

export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const processListItemSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  startedAt: z.string().nullable(),
  statusValue: z.string().nullable(),
  statusLabel: z.string().nullable(),
  statusColor: z.string().nullable(),
  statusIcon: z.string().nullable(),
  typeValue: z.string().nullable(),
  typeLabel: z.string().nullable(),
  typeColor: z.string().nullable(),
  typeIcon: z.string().nullable(),
  customerEntityId: z.uuid().nullable(),
  salesQuoteId: z.uuid().nullable(),
  salesInvoiceId: z.uuid().nullable(),
  resourceId: z.uuid().nullable(),
  selectedSupplierId: z.uuid().nullable(),
  refinancingEnabled: z.boolean(),
  refinancingNotes: z.string().nullable(),
  closedAt: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  organizationId: z.uuid(),
  tenantId: z.uuid(),
  handlerUserId: z.uuid().nullable(),
  handlerLabel: z.string().nullable(),
})

export const openApi = buildProcurementCrudOpenApi({
  resourceName: 'Procurement process',
  pluralName: 'Procurement processes',
  querySchema: listQuerySchema,
  listResponseSchema: createPagedListResponseSchema(processListItemSchema),
  create: {
    schema: procurementProcessCreateSchema,
    description: 'Creates a procurement process.',
  },
  update: {
    schema: procurementProcessUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a procurement process.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a procurement process.',
  },
})
