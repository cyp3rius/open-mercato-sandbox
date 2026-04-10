import { NextResponse } from 'next/server'
import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { InsuranceInsurer } from '../../data/entities'
import { insuranceInsurerCreateSchema, insuranceInsurerUpdateSchema } from '../../data/validators'
import {
  buildInsuranceCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '../openapi'
import { mergeInsuranceCommandScope } from '../mergeScope'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['insurance.insurers.view'] },
  POST: { requireAuth: true, requireFeatures: ['insurance.insurers.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['insurance.insurers.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['insurance.insurers.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).loose()
type CrudInput = Record<string, unknown>

const crud = makeCrudRoute<CrudInput, CrudInput, Record<string, unknown>>({
  metadata: routeMetadata,
  orm: {
    entity: InsuranceInsurer,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: {
    module: 'insurance',
    entity: 'insurer',
    persistent: true,
  },
  actions: {
    create: {
      commandId: 'insurance.insurers.create',
      schema: rawBodySchema,
      mapInput: ({ parsed, ctx }) => mergeInsuranceCommandScope(parsed as Record<string, unknown>, ctx),
      response: ({ result }) => ({ id: String(result.insurerId) }),
      status: 201,
    },
    update: {
      commandId: 'insurance.insurers.update',
      schema: rawBodySchema,
      mapInput: ({ parsed, ctx }) => mergeInsuranceCommandScope(parsed as Record<string, unknown>, ctx),
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'insurance.insurers.delete',
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
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    search: z.string().optional(),
    sortField: z.enum(['code', 'name', 'status', 'createdAt', 'updatedAt']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    isActive: z.enum(['true', 'false']).optional(),
    status: z.string().optional(),
  })
  .loose()

type InsurerRow = {
  id: string
  code: string
  name: string
  description: string | null
  status: string
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
  organizationId: string
  tenantId: string
}

const toRow = (row: InsuranceInsurer): InsurerRow => ({
  id: String(row.id),
  code: row.code,
  name: row.name,
  description: row.description ?? null,
  status: row.status,
  isActive: !!row.isActive,
  createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  organizationId: String(row.organizationId),
  tenantId: String(row.tenantId),
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

  const { id, page, pageSize, search, sortField, sortDir, isActive, status: statusFilter } = parsed.data
  const filter: FilterQuery<InsuranceInsurer> = {
    tenantId: auth.tenantId,
    deletedAt: null,
  }
  if (auth.orgId) {
    filter.organizationId = auth.orgId
  }

  if (id) filter.id = id
  if (search) {
    filter.$or = [
      { code: { $ilike: `%${search}%` } },
      { name: { $ilike: `%${search}%` } },
    ]
  }
  if (isActive === 'true') filter.isActive = true
  if (isActive === 'false') filter.isActive = false
  const statusTrimmed = statusFilter?.trim()
  if (statusTrimmed?.length) filter.status = statusTrimmed

  const fieldMap: Record<string, string> = {
    code: 'code',
    name: 'name',
    status: 'status',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  }
  const orderBy: Record<string, 'ASC' | 'DESC'> = {}
  if (sortField) {
    const mapped = fieldMap[sortField] || 'code'
    orderBy[mapped] = sortDir === 'desc' ? 'DESC' : 'ASC'
  } else {
    orderBy.code = 'ASC'
  }

  const [all, total] = await em.findAndCount(InsuranceInsurer, filter, { orderBy })
  const start = (page - 1) * pageSize
  const paged = all.slice(start, start + pageSize)
  const items = paged.map(toRow)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return NextResponse.json({ items, total, page, pageSize, totalPages })
}

export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE

const insurerListItemSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  isActive: z.boolean(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  organizationId: z.uuid(),
  tenantId: z.uuid(),
})

export const openApi = buildInsuranceCrudOpenApi({
  resourceName: 'Insurer',
  pluralName: 'Insurers',
  querySchema: listQuerySchema,
  listResponseSchema: createPagedListResponseSchema(insurerListItemSchema),
  create: {
    schema: insuranceInsurerCreateSchema,
    description: 'Creates an insurer (insurance company dictionary entry).',
  },
  update: {
    schema: insuranceInsurerUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates an insurer.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes an insurer.',
  },
})
