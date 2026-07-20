import { registerCommand, type CommandHandler, type CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { z } from 'zod'
import { CustomerEntity } from '../../customers/data/entities'
import { ServiceCase } from '../../cases/data/entities'
import {
  CatalogCustomerOffering,
  CatalogProduct,
  CatalogProductRelation,
} from '../data/entities'
import {
  cloneCaseTemplatesSnapshot,
  isSubscriptionProduct,
  shouldActivateOfferingNow,
} from '../lib/customerOffering'
import type { CatalogProductCaseTemplate } from '../data/types'
import { CATALOG_SUBPRODUCT_PRODUCT_TYPES } from '../data/types'

const activateSchema = z.object({
  offeringId: z.string().uuid(),
  tenantId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  force: z.boolean().optional(),
})

const deactivateSchema = z.object({
  offeringId: z.string().uuid(),
  tenantId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
})

async function spawnCasesForOffering(
  ctx: CommandRuntimeContext,
  em: EntityManager,
  offering: CatalogCustomerOffering,
  ownerUserId: string,
): Promise<Record<string, string>> {
  const templates = cloneCaseTemplatesSnapshot(offering.caseTemplatesSnapshot)
  const spawned: Record<string, string> = { ...(offering.spawnedCaseIds ?? {}) }
  const commandBus = ctx.container.resolve('commandBus') as {
    execute: (id: string, args: { input: unknown; ctx: CommandRuntimeContext }) => Promise<{ result?: { caseId?: string } }>
  }

  for (const template of templates) {
    if (spawned[template.id]) continue
    const recurrenceEnabled = Boolean(template.recurrenceEnabled)
    const metadata: Record<string, unknown> = {
      customerOfferingId: offering.id,
      catalogCaseTemplateId: template.id,
    }
    if (offering.endsAt) {
      metadata.recurrenceSeriesEndsAt = offering.endsAt.toISOString()
    }
    const input: Record<string, unknown> = {
      tenantId: offering.tenantId,
      organizationId: offering.organizationId,
      title: template.title,
      customerEntityId: offering.customerEntityId,
      ownerUserId,
      playbookId: template.playbookId ?? null,
      statusValue: 'open',
      metadata,
      recurrenceEnabled,
      recurrenceIntervalAmount: recurrenceEnabled ? template.recurrenceIntervalAmount ?? null : null,
      recurrenceIntervalUnit: recurrenceEnabled ? template.recurrenceIntervalUnit ?? null : null,
      recurrenceCreateLeadTime: recurrenceEnabled ? template.recurrenceCreateLeadTime ?? null : null,
      recurrenceSeriesId: null,
      recurrenceNextOccurrenceAt: null,
    }
    const { result } = await commandBus.execute('cases.cases.create', { input, ctx })
    const caseId = typeof result?.caseId === 'string' ? result.caseId : ''
    if (!caseId) {
      throw new CrudHttpError(500, { error: 'catalog.customerOfferings.caseCreateFailed' })
    }
    spawned[template.id] = caseId
  }
  return spawned
}

async function closeSpawnedCases(
  em: EntityManager,
  offering: CatalogCustomerOffering,
  now: Date,
): Promise<void> {
  const caseIds = Object.values(offering.spawnedCaseIds ?? {}).filter(
    (id): id is string => typeof id === 'string' && id.trim().length > 0,
  )
  if (!caseIds.length) return
  const cases = await em.find(ServiceCase, {
    id: { $in: caseIds },
    tenantId: offering.tenantId,
    organizationId: offering.organizationId,
    deletedAt: null,
  })
  for (const caseRow of cases) {
    if (!caseRow.closedAt) {
      caseRow.closedAt = now
      caseRow.statusValue = 'aborted'
    }
    caseRow.recurrenceEnabled = false
    caseRow.recurrenceNextOccurrenceAt = null
    caseRow.updatedAt = now
  }
}

export async function activateCustomerOfferingById(
  ctx: CommandRuntimeContext,
  offeringId: string,
  options?: { force?: boolean },
): Promise<{ ok: true; offeringId: string; spawnedCaseIds: Record<string, string> }> {
  const em = (ctx.container.resolve('em') as EntityManager).fork()
  const offering = await em.findOne(CatalogCustomerOffering, {
    id: offeringId,
    deletedAt: null,
  })
  if (!offering) throw new CrudHttpError(404, { error: 'catalog.customerOfferings.notFound' })
  if (offering.status === 'cancelled' || offering.status === 'ended') {
    throw new CrudHttpError(400, { error: 'catalog.customerOfferings.notActivatable' })
  }
  if (offering.status === 'active' && offering.spawnedCaseIds && Object.keys(offering.spawnedCaseIds).length) {
    return { ok: true, offeringId: offering.id, spawnedCaseIds: offering.spawnedCaseIds }
  }

  const customer = await findOneWithDecryption(
    em,
    CustomerEntity,
    { id: offering.customerEntityId, deletedAt: null },
    undefined,
    { tenantId: offering.tenantId, organizationId: offering.organizationId },
  )
  const ownerUserId = customer?.ownerUserId?.trim() || ''
  if (!ownerUserId) {
    throw new CrudHttpError(400, { error: 'catalog.customerOfferings.guardianRequired' })
  }

  const now = new Date()
  const force = Boolean(options?.force)
  const isSubscription = await isSubscriptionProduct(em, offering.productId)
  if (
    !force &&
    !shouldActivateOfferingNow({
      isSubscription,
      startsAt: offering.startsAt,
      now,
    })
  ) {
    return { ok: true, offeringId: offering.id, spawnedCaseIds: offering.spawnedCaseIds ?? {} }
  }

  const spawnedCaseIds = await spawnCasesForOffering(ctx, em, offering, ownerUserId)
  offering.status = 'active'
  offering.activatedAt = now
  offering.spawnedCaseIds = spawnedCaseIds
  offering.updatedAt = now
  await em.flush()
  return { ok: true, offeringId: offering.id, spawnedCaseIds }
}

export async function deactivateCustomerOfferingById(
  ctx: CommandRuntimeContext,
  offeringId: string,
): Promise<{ ok: true; offeringId: string }> {
  const em = (ctx.container.resolve('em') as EntityManager).fork()
  const offering = await em.findOne(CatalogCustomerOffering, {
    id: offeringId,
    deletedAt: null,
  })
  if (!offering) throw new CrudHttpError(404, { error: 'catalog.customerOfferings.notFound' })
  if (offering.status === 'cancelled') {
    return { ok: true, offeringId: offering.id }
  }

  const now = new Date()
  await closeSpawnedCases(em, offering, now)
  offering.status = 'cancelled'
  offering.updatedAt = now
  await em.flush()

  const children = await em.find(CatalogCustomerOffering, {
    parentOfferingId: offering.id,
    deletedAt: null,
  })
  for (const child of children) {
    if (child.status === 'cancelled') continue
    await closeSpawnedCases(em, child, now)
    child.status = 'cancelled'
    child.updatedAt = now
  }
  if (children.length) await em.flush()

  return { ok: true, offeringId: offering.id }
}

export async function deactivateOfferingsForOrder(
  ctx: CommandRuntimeContext,
  input: { salesOrderId: string; tenantId: string; organizationId: string },
): Promise<void> {
  const em = (ctx.container.resolve('em') as EntityManager).fork()
  const offerings = await em.find(CatalogCustomerOffering, {
    salesOrderId: input.salesOrderId,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    deletedAt: null,
    status: { $nin: ['cancelled'] },
    parentOfferingId: null,
  })
  for (const offering of offerings) {
    await deactivateCustomerOfferingById(ctx, offering.id)
  }
}

export async function deactivateOfferingsForOrderLines(
  ctx: CommandRuntimeContext,
  input: {
    salesOrderLineIds: string[]
    tenantId: string
    organizationId: string
  },
): Promise<void> {
  if (!input.salesOrderLineIds.length) return
  const em = (ctx.container.resolve('em') as EntityManager).fork()
  const offerings = await em.find(CatalogCustomerOffering, {
    salesOrderLineId: { $in: input.salesOrderLineIds },
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    deletedAt: null,
    status: { $nin: ['cancelled'] },
    parentOfferingId: null,
  })
  for (const offering of offerings) {
    await deactivateCustomerOfferingById(ctx, offering.id)
  }
}

const activateCommand: CommandHandler<
  z.infer<typeof activateSchema>,
  { ok: true; offeringId: string; spawnedCaseIds: Record<string, string> }
> = {
  id: 'catalog.customer_offerings.activate',
  async execute(input, ctx) {
    const parsed = activateSchema.parse(input)
    return activateCustomerOfferingById(ctx, parsed.offeringId, { force: parsed.force })
  },
}

const deactivateCommand: CommandHandler<z.infer<typeof deactivateSchema>, { ok: true; offeringId: string }> = {
  id: 'catalog.customer_offerings.deactivate',
  async execute(input, ctx) {
    const parsed = deactivateSchema.parse(input)
    return deactivateCustomerOfferingById(ctx, parsed.offeringId)
  },
}

registerCommand(activateCommand)
registerCommand(deactivateCommand)

export async function upsertCustomerOfferingFromOrderLine(
  em: EntityManager,
  input: {
    tenantId: string
    organizationId: string
    customerEntityId: string
    product: CatalogProduct
    salesOrderId: string
    salesOrderLineId: string
    subscriptionStartsAt?: Date | null
    subscriptionEndsAt?: Date | null
    parentOfferingId?: string | null
  },
): Promise<CatalogCustomerOffering> {
  const existing = await em.findOne(CatalogCustomerOffering, {
    salesOrderLineId: input.salesOrderLineId,
    productId: input.product.id,
    deletedAt: null,
  })
  const templates = cloneCaseTemplatesSnapshot(
    (input.product.caseTemplates ?? null) as CatalogProductCaseTemplate[] | null,
  )
  const now = new Date()
  const isSubscription = await isSubscriptionProduct(em, input.product.id)
  const startsAt = isSubscription
    ? input.subscriptionStartsAt ?? null
    : now
  const endsAt = isSubscription ? input.subscriptionEndsAt ?? null : null

  if (existing) {
    if (existing.status === 'active' || existing.status === 'cancelled') return existing
    existing.customerEntityId = input.customerEntityId
    existing.productId = input.product.id
    existing.startsAt = startsAt
    existing.endsAt = endsAt
    existing.parentOfferingId = input.parentOfferingId ?? existing.parentOfferingId ?? null
    existing.caseTemplatesSnapshot = templates
    existing.updatedAt = now
    await em.flush()
    return existing
  }

  const offering = em.create(CatalogCustomerOffering, {
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    customerEntityId: input.customerEntityId,
    productId: input.product.id,
    salesOrderId: input.salesOrderId,
    salesOrderLineId: input.salesOrderLineId,
    parentOfferingId: input.parentOfferingId ?? null,
    status: 'pending',
    startsAt,
    endsAt,
    activatedAt: null,
    caseTemplatesSnapshot: templates,
    spawnedCaseIds: {},
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  })
  em.persist(offering)
  await em.flush()
  return offering
}

export async function expandBundleChildProducts(
  em: EntityManager,
  product: CatalogProduct,
): Promise<CatalogProduct[]> {
  if (!CATALOG_SUBPRODUCT_PRODUCT_TYPES.includes(product.productType as (typeof CATALOG_SUBPRODUCT_PRODUCT_TYPES)[number])) {
    return []
  }
  const relations = await em.find(
    CatalogProductRelation,
    {
      parentProduct: product.id,
      organizationId: product.organizationId,
      tenantId: product.tenantId,
      relationType: { $in: ['bundle', 'grouped'] },
    },
    { orderBy: { position: 'asc' }, populate: ['childProduct'] },
  )
  const children: CatalogProduct[] = []
  for (const relation of relations) {
    const child = relation.childProduct
    if (!child || child.deletedAt) continue
    children.push(child)
  }
  return children
}
