import { NextResponse } from 'next/server'
import { z } from 'zod'
import { parseBooleanFromUnknown } from '@open-mercato/shared/lib/boolean'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { escapeLikePattern } from '@open-mercato/shared/lib/db/escapeLikePattern'
import { AccountingInvoice } from '../../data/entities'
import {
  accountingInvoiceCreateSchema,
  accountingInvoiceUpdateSchema,
  accountingInvoiceDeleteSchema,
  accountingInvoiceKindSchema,
} from '../../data/validators'
import { ACCOUNTING_INVOICE_ENTITY_ID } from '../../lib/constants'
import {
  createAccountingCrudOpenApi,
  createPagedListResponseSchema,
  defaultOkResponseSchema,
} from '../openapi'

const routeMetadata = {
  GET: { requireAuth: true, requireFeatures: ['accounting.invoices.view'] },
  POST: { requireAuth: true, requireFeatures: ['accounting.invoices.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['accounting.invoices.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['accounting.invoices.manage'] },
}

export const metadata = routeMetadata

const rawBodySchema = z.object({}).passthrough()
const crud = makeCrudRoute<Record<string, unknown>, Record<string, unknown>, Record<string, unknown>>({
  metadata: routeMetadata,
  orm: {
    entity: AccountingInvoice,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  indexer: { entityType: ACCOUNTING_INVOICE_ENTITY_ID },
  actions: {
    create: {
      commandId: 'accounting.invoices.create',
      schema: rawBodySchema,
      mapInput: ({ parsed, ctx }) => ({
        ...parsed,
        organizationId: parsed.organizationId ?? ctx.selectedOrganizationId ?? ctx.auth?.orgId ?? undefined,
        tenantId: parsed.tenantId ?? ctx.auth?.tenantId ?? undefined,
      }),
      response: ({ result }) => ({ id: String(result.invoiceId) }),
      status: 201,
    },
    update: {
      commandId: 'accounting.invoices.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'accounting.invoices.delete',
      schema: rawBodySchema,
      mapInput: ({ raw, ctx }) => ({
        id: ((raw as Record<string, unknown>).query as Record<string, unknown> | undefined)?.id as string | undefined,
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
    ids: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    search: z.string().optional(),
    sortField: z.enum(['documentNumber', 'issueDate', 'createdAt', 'updatedAt']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    documentKind: accountingInvoiceKindSchema.optional(),
    /** Dashboard tabs: income (issued + imported sales), cost (imported cost), drafts (isDraft) */
    listScope: z.enum(['income', 'cost', 'drafts']).optional(),
    isDraft: z
      .union([z.boolean(), z.string()])
      .optional()
      .transform((v) => {
        if (v === undefined) return undefined
        const parsed = parseBooleanFromUnknown(v)
        return parsed === null ? undefined : parsed
      }),
    /** Exact match (e.g. PLN, EUR) when set */
    currencyCode: z.string().optional(),
    /** Substring match on `sourceSystem` (import / integration label) */
    sourceSystem: z.string().optional(),
  })
  .passthrough()

type AccountingInvoiceRow = {
  id: string
  organizationId: string
  tenantId: string
  documentNumber: string
  documentKind: string
  issueDate: string
  salesDate: string | null
  paymentDueDate: string | null
  paymentTermDays: number | null
  paymentMethod: 'cash' | 'transfer' | 'card' | null
  paymentAccount: string | null
  sellerEntityId: string | null
  sellerName: string | null
  sellerNip: string | null
  sellerRegon: string | null
  sellerAddress: string | null
  buyerEntityId: string | null
  buyerName: string | null
  buyerNip: string | null
  buyerRegon: string | null
  buyerAddress: string | null
  lineItems: Array<{
    name: string
    unit: string
    quantity: string
    unitPriceNet: string
    taxRate: string
  }> | null
  title: string | null
  counterpartyName: string | null
  externalReference: string | null
  currencyCode: string | null
  totalAmount: string | null
  sourceSystem: string | null
  notes: string | null
  isDraft: boolean
  createdAt: string
  updatedAt: string
}

const toRow = (entry: AccountingInvoice): AccountingInvoiceRow => ({
  id: String(entry.id),
  organizationId: String(entry.organizationId),
  tenantId: String(entry.tenantId),
  documentNumber: String(entry.documentNumber),
  documentKind: String(entry.documentKind),
  issueDate: entry.issueDate.toISOString().slice(0, 10),
  salesDate: entry.salesDate ? entry.salesDate.toISOString().slice(0, 10) : null,
  paymentDueDate: entry.paymentDueDate ? entry.paymentDueDate.toISOString().slice(0, 10) : null,
  paymentTermDays: entry.paymentTermDays ?? null,
  paymentMethod: (entry.paymentMethod as AccountingInvoiceRow['paymentMethod']) ?? null,
  paymentAccount: entry.paymentAccount ?? null,
  sellerEntityId: entry.sellerEntityId ?? null,
  sellerName: entry.sellerName ?? null,
  sellerNip: entry.sellerNip ?? null,
  sellerRegon: entry.sellerRegon ?? null,
  sellerAddress: entry.sellerAddress ?? null,
  buyerEntityId: entry.buyerEntityId ?? null,
  buyerName: entry.buyerName ?? null,
  buyerNip: entry.buyerNip ?? null,
  buyerRegon: entry.buyerRegon ?? null,
  buyerAddress: entry.buyerAddress ?? null,
  lineItems: Array.isArray(entry.lineItems) ? entry.lineItems : null,
  title: entry.title ?? null,
  counterpartyName: entry.counterpartyName ?? null,
  externalReference: entry.externalReference ?? null,
  currencyCode: entry.currencyCode ?? null,
  totalAmount: entry.totalAmount ?? null,
  sourceSystem: entry.sourceSystem ?? null,
  notes: entry.notes ?? null,
  isDraft: Boolean(entry.isDraft),
  createdAt: entry.createdAt.toISOString(),
  updatedAt: entry.updatedAt.toISOString(),
})

export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req)
  if (!auth?.tenantId || !auth?.orgId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const parsed = listQuerySchema.parse(Object.fromEntries(url.searchParams.entries()))

  const { resolve } = await createRequestContainer()
  const em = (resolve('em') as EntityManager).fork()

  const filters: Record<string, unknown> = {
    tenantId: auth.tenantId,
    organizationId: auth.orgId,
    deletedAt: null,
  }
  if (parsed.id) filters.id = parsed.id

  if (parsed.listScope === 'income') {
    const incomeKinds = ['issued', 'imported_sales'] as const
    if (parsed.documentKind && incomeKinds.includes(parsed.documentKind as (typeof incomeKinds)[number])) {
      filters.documentKind = parsed.documentKind
    } else {
      filters.documentKind = { $in: [...incomeKinds] }
    }
    filters.isDraft = false
  } else if (parsed.listScope === 'cost') {
    filters.documentKind = 'imported_cost'
    filters.isDraft = false
  } else if (parsed.listScope === 'drafts') {
    filters.isDraft = true
    if (parsed.documentKind) {
      filters.documentKind = parsed.documentKind
    }
  } else {
    if (parsed.documentKind) filters.documentKind = parsed.documentKind
    if (parsed.isDraft !== undefined) filters.isDraft = parsed.isDraft
  }

  const currencyCodeFilter = parsed.currencyCode?.trim()
  if (currencyCodeFilter) filters.currencyCode = currencyCodeFilter
  const sourceSystemFilter = parsed.sourceSystem?.trim()
  if (sourceSystemFilter) {
    const like = `%${escapeLikePattern(sourceSystemFilter)}%`
    filters.sourceSystem = { $ilike: like }
  }

  if (parsed.ids) {
    const values = parsed.ids
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0)
    if (values.length > 0) filters.id = { $in: values }
  }

  const search = parsed.search?.trim() ?? ''
  if (search.length > 0) {
    const like = `%${escapeLikePattern(search)}%`
    filters.$or = [
      { documentNumber: { $ilike: like } },
      { title: { $ilike: like } },
      { counterpartyName: { $ilike: like } },
      { externalReference: { $ilike: like } },
      { notes: { $ilike: like } },
    ]
  }

  const page = parsed.page
  const pageSize = parsed.pageSize
  const offset = (page - 1) * pageSize
  const sortFieldMap = {
    documentNumber: 'documentNumber',
    issueDate: 'issueDate',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  } as const
  const sortField = sortFieldMap[parsed.sortField ?? 'issueDate'] ?? 'issueDate'
  const sortDir = parsed.sortDir ?? 'desc'
  const orderBy = { [sortField]: sortDir } as Record<string, 'asc' | 'desc'>

  const [items, total] = await em.findAndCount(AccountingInvoice, filters, { orderBy, limit: pageSize, offset })
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

const accountingInvoiceListItemSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  tenantId: z.uuid(),
  documentNumber: z.string(),
  documentKind: accountingInvoiceKindSchema,
  issueDate: z.string(),
  salesDate: z.string().nullable(),
  paymentDueDate: z.string().nullable(),
  paymentTermDays: z.number().int().nullable(),
  paymentMethod: z.enum(['cash', 'transfer', 'card']).nullable(),
  paymentAccount: z.string().nullable(),
  sellerEntityId: z.uuid().nullable(),
  sellerName: z.string().nullable(),
  sellerNip: z.string().nullable(),
  sellerRegon: z.string().nullable(),
  sellerAddress: z.string().nullable(),
  buyerEntityId: z.uuid().nullable(),
  buyerName: z.string().nullable(),
  buyerNip: z.string().nullable(),
  buyerRegon: z.string().nullable(),
  buyerAddress: z.string().nullable(),
  lineItems: z
    .array(
      z.object({
        name: z.string(),
        unit: z.string(),
        quantity: z.string(),
        unitPriceNet: z.string(),
        taxRate: z.string(),
      }),
    )
    .nullable(),
  title: z.string().nullable(),
  counterpartyName: z.string().nullable(),
  externalReference: z.string().nullable(),
  currencyCode: z.string().nullable(),
  totalAmount: z.string().nullable(),
  sourceSystem: z.string().nullable(),
  notes: z.string().nullable(),
  isDraft: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const openApi = createAccountingCrudOpenApi({
  resourceName: 'Accounting Invoice',
  pluralName: 'Accounting Invoices',
  querySchema: listQuerySchema,
  listResponseSchema: createPagedListResponseSchema(accountingInvoiceListItemSchema),
  create: {
    schema: accountingInvoiceCreateSchema,
    description: 'Creates a new accounting invoice.',
  },
  update: {
    schema: accountingInvoiceUpdateSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Updates an existing accounting invoice by id.',
  },
  del: {
    schema: accountingInvoiceDeleteSchema,
    responseSchema: defaultOkResponseSchema,
    description: 'Soft-deletes an accounting invoice by id.',
  },
})
