import { NextResponse } from 'next/server'
import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { ProcurementProcessSupplier } from '../../data/entities'
import { procurementSupplierCreateSchema, procurementSupplierUpdateSchema } from '../../data/validators'
import {
  buildProcurementCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '../openapi'
import { mergeProcurementCommandScope } from '../mergeScope'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['procurement.processes.view'] },
  POST: { requireAuth: true, requireFeatures: ['procurement.processes.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['procurement.processes.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['procurement.processes.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).loose()
type CrudInput = Record<string, unknown>

const crud = makeCrudRoute<CrudInput, CrudInput, Record<string, unknown>>({
  metadata: routeMetadata,
  orm: {
    entity: ProcurementProcessSupplier,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: {
    module: 'procurement',
    entity: 'process_supplier',
    persistent: true,
  },
  actions: {
    create: {
      commandId: 'procurement.process_suppliers.create',
      schema: rawBodySchema,
      mapInput: ({ parsed, ctx }) => mergeProcurementCommandScope(parsed as Record<string, unknown>, ctx),
      response: ({ result }) => ({ id: String((result as { supplierId: string }).supplierId) }),
      status: 201,
    },
    update: {
      commandId: 'procurement.process_suppliers.update',
      schema: rawBodySchema,
      mapInput: ({ parsed, ctx }) => mergeProcurementCommandScope(parsed as Record<string, unknown>, ctx),
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'procurement.process_suppliers.delete',
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
    processId: z.uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    search: z.string().optional(),
    sortField: z.enum(['vendorLabel', 'sortOrder', 'createdAt', 'updatedAt']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .loose()

type SupplierRow = {
  id: string
  processId: string
  vendorCustomerEntityId: string | null
  vendorLabel: string
  contactName: string | null
  email: string | null
  phone: string | null
  website: string | null
  notes: string | null
  offerSummary: string | null
  sortOrder: number
  createdAt: string | null
  updatedAt: string | null
  organizationId: string
  tenantId: string
}

const toRow = (row: ProcurementProcessSupplier): SupplierRow => {
  const proc = row.process
  const processId = typeof proc === 'string' ? proc : proc.id
  const vce = row.vendorCustomerEntity
  const vendorCustomerEntityId =
    vce && typeof vce === 'object' && 'id' in vce ? String((vce as { id: string }).id) : null
  return {
    id: String(row.id),
    processId,
    vendorCustomerEntityId,
    vendorLabel: row.vendorLabel,
    contactName: row.contactName ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    website: row.website ?? null,
    notes: row.notes ?? null,
    offerSummary: row.offerSummary ?? null,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt ? row.createdAt.toISOString() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
    organizationId: String(row.organizationId),
    tenantId: String(row.tenantId),
  }
}

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

  const { id, processId, page, pageSize, search, sortField, sortDir } = parsed.data
  const filter: FilterQuery<ProcurementProcessSupplier> = {
    tenantId: auth.tenantId,
    deletedAt: null,
  }
  if (auth.orgId) {
    filter.organizationId = auth.orgId
  }

  if (id) filter.id = id
  if (processId) filter.process = processId
  if (search) {
    filter.vendorLabel = { $ilike: `%${search}%` }
  }

  const fieldMap: Record<string, string> = {
    vendorLabel: 'vendorLabel',
    sortOrder: 'sortOrder',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  }
  const orderBy: Record<string, 'ASC' | 'DESC'> = {}
  if (sortField) {
    const mapped = fieldMap[sortField] || 'createdAt'
    orderBy[mapped] = sortDir === 'desc' ? 'DESC' : 'ASC'
  } else {
    orderBy.createdAt = 'ASC'
  }

  const [all, total] = await em.findAndCount(ProcurementProcessSupplier, filter, {
    orderBy,
    populate: ['process', 'vendorCustomerEntity'],
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

const supplierListItemSchema = z.object({
  id: z.uuid(),
  processId: z.uuid(),
  vendorCustomerEntityId: z.uuid().nullable(),
  vendorLabel: z.string(),
  contactName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  notes: z.string().nullable(),
  offerSummary: z.string().nullable(),
  sortOrder: z.number(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  organizationId: z.uuid(),
  tenantId: z.uuid(),
})

export const openApi = buildProcurementCrudOpenApi({
  resourceName: 'Procurement process supplier',
  pluralName: 'Procurement process suppliers',
  querySchema: listQuerySchema,
  listResponseSchema: createPagedListResponseSchema(supplierListItemSchema),
  create: {
    schema: procurementSupplierCreateSchema,
    description: 'Adds a supplier candidate to a procurement process.',
  },
  update: {
    schema: procurementSupplierUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates a procurement supplier row.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes a procurement supplier.',
  },
})
