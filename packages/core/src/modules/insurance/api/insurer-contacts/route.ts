import { NextResponse } from 'next/server'
import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { FilterQuery } from '@mikro-orm/core'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { InsuranceInsurerContact } from '../../data/entities'
import { insuranceInsurerContactCreateSchema, insuranceInsurerContactUpdateSchema } from '../../data/validators'
import {
  buildInsuranceCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '../openapi'
import { mergeInsuranceCommandScope } from '../mergeScope'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['insurance.insurer_contacts.view'] },
  POST: { requireAuth: true, requireFeatures: ['insurance.insurer_contacts.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['insurance.insurer_contacts.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['insurance.insurer_contacts.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).loose()
type CrudInput = Record<string, unknown>

const crud = makeCrudRoute<CrudInput, CrudInput, Record<string, unknown>>({
  metadata: routeMetadata,
  orm: {
    entity: InsuranceInsurerContact,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: {
    module: 'insurance',
    entity: 'insurer_contact',
    persistent: true,
  },
  actions: {
    create: {
      commandId: 'insurance.insurer_contacts.create',
      schema: rawBodySchema,
      mapInput: ({ parsed, ctx }) => mergeInsuranceCommandScope(parsed as Record<string, unknown>, ctx),
      response: ({ result }) => ({ id: String(result.contactId) }),
      status: 201,
    },
    update: {
      commandId: 'insurance.insurer_contacts.update',
      schema: rawBodySchema,
      mapInput: ({ parsed, ctx }) => mergeInsuranceCommandScope(parsed as Record<string, unknown>, ctx),
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'insurance.insurer_contacts.delete',
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
    insurerId: z.uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    search: z.string().optional(),
    sortField: z.enum(['fullName', 'createdAt', 'updatedAt']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    isActive: z.enum(['true', 'false']).optional(),
  })
  .loose()

type ContactRow = {
  id: string
  insurerId: string
  fullName: string
  email: string | null
  phone: string | null
  role: string | null
  isDefault: boolean
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
  organizationId: string
  tenantId: string
}

const toRow = (row: InsuranceInsurerContact): ContactRow => {
  const ins = row.insurer
  const insurerId = typeof ins === 'string' ? ins : ins.id
  return {
    id: String(row.id),
    insurerId,
    fullName: row.fullName,
    email: row.email ?? null,
    phone: row.phone ?? null,
    role: row.role ?? null,
    isDefault: !!row.isDefault,
    isActive: !!row.isActive,
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

  const { id, insurerId, page, pageSize, search, sortField, sortDir, isActive } = parsed.data
  const filter: FilterQuery<InsuranceInsurerContact> = {
    tenantId: auth.tenantId,
    deletedAt: null,
  }
  if (auth.orgId) {
    filter.organizationId = auth.orgId
  }

  if (id) filter.id = id
  if (insurerId) filter.insurer = insurerId
  if (search) {
    filter.$or = [
      { fullName: { $ilike: `%${search}%` } },
      { email: { $ilike: `%${search}%` } },
    ]
  }
  if (isActive === 'true') filter.isActive = true
  if (isActive === 'false') filter.isActive = false

  const fieldMap: Record<string, string> = {
    fullName: 'fullName',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  }
  const orderBy: Record<string, 'ASC' | 'DESC'> = {}
  if (sortField) {
    const mapped = fieldMap[sortField] || 'fullName'
    orderBy[mapped] = sortDir === 'desc' ? 'DESC' : 'ASC'
  } else {
    orderBy.fullName = 'ASC'
  }

  const [all, total] = await em.findAndCount(InsuranceInsurerContact, filter, {
    orderBy,
    populate: ['insurer'],
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

const contactListItemSchema = z.object({
  id: z.uuid(),
  insurerId: z.uuid(),
  fullName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  role: z.string().nullable(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  organizationId: z.uuid(),
  tenantId: z.uuid(),
})

export const openApi = buildInsuranceCrudOpenApi({
  resourceName: 'InsurerContact',
  pluralName: 'Insurer contacts',
  querySchema: listQuerySchema,
  listResponseSchema: createPagedListResponseSchema(contactListItemSchema),
  create: {
    schema: insuranceInsurerContactCreateSchema,
    description: 'Creates a contact person for an insurer.',
  },
  update: {
    schema: insuranceInsurerContactUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates an insurer contact.',
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes an insurer contact.',
  },
})
