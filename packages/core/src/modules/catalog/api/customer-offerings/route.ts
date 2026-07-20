import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { CatalogCustomerOffering, CatalogProduct } from '../../data/entities'
import { CustomerEntity } from '@open-mercato/core/modules/customers/data/entities'

export const metadata = {
  GET: {
    requireAuth: true,
    requireAnyFeatures: ['catalog.customer_offerings.view', 'catalog.simple_offerings.view'],
  },
}

export const openApi = {
  tags: ['Catalog'],
  summary: 'List customer product offerings',
}

const querySchema = z.object({
  customerEntityId: z.string().uuid().optional(),
  status: z.string().trim().min(1).max(120).optional(),
  productId: z.string().uuid().optional(),
  search: z.string().trim().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
})

export async function GET(req: Request) {
  const auth = await getAuthFromRequest(req)
  if (!auth?.tenantId || !auth.orgId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const url = new URL(req.url)
  const parsed = querySchema.safeParse({
    customerEntityId: url.searchParams.get('customerEntityId') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    productId: url.searchParams.get('productId') ?? undefined,
    search: url.searchParams.get('search') ?? undefined,
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query' }, { status: 400 })
  }

  const container = await createRequestContainer()
  const em = container.resolve<EntityManager>('em').fork()
  const where: FilterQuery<CatalogCustomerOffering> = {
    tenantId: auth.tenantId,
    organizationId: auth.orgId,
    deletedAt: null,
  }
  if (parsed.data.customerEntityId) {
    where.customerEntityId = parsed.data.customerEntityId
  }
  if (parsed.data.status) {
    where.status = parsed.data.status
  }
  if (parsed.data.productId) {
    where.productId = parsed.data.productId
  }

  let productIdFilter: string[] | null = null
  if (parsed.data.search) {
    const products = await em.find(
      CatalogProduct,
      {
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
        deletedAt: null,
        title: { $ilike: `%${parsed.data.search}%` },
      },
      { fields: ['id'], limit: 100 },
    )
    productIdFilter = products.map((product) => product.id)
    if (!productIdFilter.length) {
      return NextResponse.json({
        items: [],
        total: 0,
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
      })
    }
    where.productId = { $in: productIdFilter }
  }

  const [items, total] = await em.findAndCount(CatalogCustomerOffering, where, {
    orderBy: { createdAt: 'desc' },
    limit: parsed.data.pageSize,
    offset: (parsed.data.page - 1) * parsed.data.pageSize,
  })

  const productIds = [...new Set(items.map((item) => item.productId))]
  const customerIds = [...new Set(items.map((item) => item.customerEntityId))]
  const products = productIds.length
    ? await em.find(CatalogProduct, {
        id: { $in: productIds },
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
        deletedAt: null,
      })
    : []
  const customers = customerIds.length
    ? await em.find(CustomerEntity, {
        id: { $in: customerIds },
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
        deletedAt: null,
      })
    : []
  const productTitleById = new Map(products.map((product) => [product.id, product.title ?? product.id]))
  const customerNameById = new Map(
    customers.map((customer) => [customer.id, customer.displayName ?? customer.id]),
  )

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productTitle: productTitleById.get(item.productId) ?? item.productId,
      customerEntityId: item.customerEntityId,
      customerName: customerNameById.get(item.customerEntityId) ?? item.customerEntityId,
      salesOrderId: item.salesOrderId,
      salesOrderLineId: item.salesOrderLineId,
      parentOfferingId: item.parentOfferingId ?? null,
      status: item.status,
      startsAt: item.startsAt ? item.startsAt.toISOString() : null,
      endsAt: item.endsAt ? item.endsAt.toISOString() : null,
      activatedAt: item.activatedAt ? item.activatedAt.toISOString() : null,
      spawnedCaseCount: Object.keys(item.spawnedCaseIds ?? {}).length,
      createdAt: item.createdAt.toISOString(),
    })),
    total,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
  })
}
