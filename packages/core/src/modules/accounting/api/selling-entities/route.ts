import { NextResponse } from 'next/server'
import { z } from 'zod'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import type { EntityManager } from '@mikro-orm/postgresql'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import {
  AccountingSellingEntity,
  type AccountingSellingEntityBankAccount,
} from '../../data/entities'

const routeMetadata = {
  GET: {
    requireAuth: true,
    requireAnyFeatures: ['accounting.invoices.view', 'accounting.settings.view', 'accounting.settings.manage'],
  },
  POST: { requireAuth: true, requireFeatures: ['accounting.settings.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['accounting.settings.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['accounting.settings.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()

const crud = makeCrudRoute<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>({
  metadata: routeMetadata,
  orm: {
    entity: AccountingSellingEntity,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  actions: {
    create: {
      commandId: 'accounting.selling_entities.create',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => {
        const p = parsed as Record<string, unknown>
        return {
          ...p,
          organizationId: p.organizationId ?? ctx.selectedOrganizationId ?? ctx.auth?.orgId,
          tenantId: p.tenantId ?? ctx.auth?.tenantId,
        }
      },
      response: ({ result }) => ({ id: String((result as { sellingEntityId: string }).sellingEntityId) }),
      status: 201,
    },
    update: {
      commandId: 'accounting.selling_entities.update',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => {
        const p = parsed as Record<string, unknown>
        return {
          ...p,
          organizationId: p.organizationId ?? ctx.selectedOrganizationId ?? ctx.auth?.orgId,
          tenantId: p.tenantId ?? ctx.auth?.tenantId,
        }
      },
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'accounting.selling_entities.delete',
      schema: rawBodySchema,
      mapInput: async ({ parsed, ctx }) => {
        const p = parsed as { body?: Record<string, unknown>; query?: Record<string, unknown> }
        const id = (p.body?.id ?? p.query?.id) as string | undefined
        return {
          id: id ? String(id) : '',
          organizationId: ctx.selectedOrganizationId ?? ctx.auth?.orgId,
          tenantId: ctx.auth?.tenantId,
        }
      },
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
    sortField: z.enum(['name', 'createdAt', 'updatedAt']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .passthrough()

export type AccountingSellingEntityRow = {
  id: string
  organizationId: string
  tenantId: string
  name: string
  nip: string | null
  regon: string | null
  address: string | null
  bankAccounts: AccountingSellingEntityBankAccount[] | null
  invoiceNumberingMode: string
  invoiceNumberingCustom: string | null
  nextInvoiceSeq: number
  invoiceSeqYear: number | null
  createdAt: string
  updatedAt: string
}

const toRow = (entry: AccountingSellingEntity): AccountingSellingEntityRow => ({
  id: String(entry.id),
  organizationId: String(entry.organizationId),
  tenantId: String(entry.tenantId),
  name: entry.name,
  nip: entry.nip ?? null,
  regon: entry.regon ?? null,
  address: entry.address ?? null,
  bankAccounts: Array.isArray(entry.bankAccounts) ? entry.bankAccounts : null,
  invoiceNumberingMode: entry.invoiceNumberingMode,
  invoiceNumberingCustom: entry.invoiceNumberingCustom ?? null,
  nextInvoiceSeq: entry.nextInvoiceSeq,
  invoiceSeqYear: entry.invoiceSeqYear ?? null,
  createdAt: entry.createdAt.toISOString(),
  updatedAt: entry.updatedAt.toISOString(),
})

export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req)
  if (!auth?.tenantId || !auth?.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const parsed = listQuerySchema.parse(Object.fromEntries(url.searchParams.entries()))

  const { resolve } = await createRequestContainer()
  const em = (resolve('em') as EntityManager).fork()

  const filters: Record<string, unknown> = {
    tenantId: auth.tenantId,
    organizationId: auth.orgId,
    deletedAt: null,
  }
  if (parsed.id) {
    filters.id = parsed.id
  }

  const search = parsed.search?.trim() ?? ''
  if (search.length > 0) {
    const like = `%${escapeLikePattern(search)}%`
    filters.$or = [{ name: { $ilike: like } }, { nip: { $ilike: like } }, { regon: { $ilike: like } }]
  }

  const page = parsed.page
  const pageSize = parsed.pageSize
  const offset = (page - 1) * pageSize
  const sortFieldMap = {
    name: 'name',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  } as const
  const sortField = sortFieldMap[parsed.sortField ?? 'name'] ?? 'name'
  const sortDir = parsed.sortDir ?? 'asc'
  const orderBy = { [sortField]: sortDir } as Record<string, 'asc' | 'desc'>

  const [items, total] = await em.findAndCount(AccountingSellingEntity, filters, { orderBy, limit: pageSize, offset })
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1

  return NextResponse.json({
    items: items.map(toRow),
    total,
    page,
    pageSize,
    totalPages,
  })
}

export const POST = crud.POST
export const PUT = crud.PUT
export const DELETE = crud.DELETE
