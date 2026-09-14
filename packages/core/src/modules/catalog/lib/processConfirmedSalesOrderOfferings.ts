import type { EntityManager } from '@mikro-orm/postgresql'
import { CustomerEntity } from '../../customers/data/entities'
import { CatalogProduct } from '../data/entities'
import {
  activateCustomerOfferingById,
  expandBundleChildProducts,
  upsertCustomerOfferingFromOrderLine,
} from '../commands/customerOfferings'
import { isSubscriptionProduct, shouldActivateOfferingNow } from '../lib/customerOffering'
import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { SalesOrder, SalesOrderLine } from '../../sales/data/entities'
import { loadSalesSettings } from '../../sales/commands/settings'
import { isSubscriptionActivationOrderStatus } from '../../sales/lib/subscriptionActivation'
import type { CatalogProductCaseTemplate } from '../data/types'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'

type OrderPayload = {
  id?: string
  orderId?: string
  tenantId?: string
  organizationId?: string
  status?: string | null
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export type ProcessSalesOrderOfferingsOptions = {
  /** Bypass order-status gate and subscription startsAt; spawn all case-plan items. */
  force?: boolean
  /** Prefer request-scoped command context (manual API). */
  commandCtx?: CommandRuntimeContext
}

export type ProcessSalesOrderOfferingsResult = {
  processedLines: number
  activatedOfferings: number
  spawnedCaseCount: number
}

async function loadActivationStatuses(
  em: EntityManager,
  tenantId: string,
  organizationId: string,
): Promise<string[] | null> {
  const settings = await loadSalesSettings(em, { tenantId, organizationId })
  return settings?.subscriptionActivationOrderStatuses ?? null
}

function buildCommandCtx(
  ctx: ResolverContext,
  tenantId: string,
  organizationId: string,
): CommandRuntimeContext {
  return {
    container: {
      resolve: ctx.resolve,
    },
    auth: {
      tenantId,
      orgId: organizationId,
      sub: null,
    },
    selectedOrganizationId: organizationId,
  } as unknown as CommandRuntimeContext
}

async function activateIfReady(
  em: EntityManager,
  commandCtx: CommandRuntimeContext,
  offering: { id: string; productId: string; startsAt?: Date | null },
  options?: { force?: boolean },
): Promise<{ activated: boolean; spawnedCaseCount: number }> {
  if (options?.force) {
    const result = await activateCustomerOfferingById(commandCtx, offering.id, { force: true })
    return {
      activated: true,
      spawnedCaseCount: Object.keys(result.spawnedCaseIds ?? {}).length,
    }
  }
  const isSubscription = await isSubscriptionProduct(em, offering.productId)
  if (
    shouldActivateOfferingNow({
      isSubscription,
      startsAt: offering.startsAt,
    })
  ) {
    const result = await activateCustomerOfferingById(commandCtx, offering.id)
    return {
      activated: true,
      spawnedCaseCount: Object.keys(result.spawnedCaseIds ?? {}).length,
    }
  }
  return { activated: false, spawnedCaseCount: 0 }
}

export async function processConfirmedSalesOrderOfferings(
  payload: OrderPayload,
  ctx: ResolverContext,
  options?: ProcessSalesOrderOfferingsOptions,
): Promise<ProcessSalesOrderOfferingsResult> {
  const force = Boolean(options?.force)
  const empty: ProcessSalesOrderOfferingsResult = {
    processedLines: 0,
    activatedOfferings: 0,
    spawnedCaseCount: 0,
  }
  const orderId = payload.id ?? payload.orderId
  const tenantId = payload.tenantId
  const organizationId = payload.organizationId
  if (!orderId || !tenantId || !organizationId) {
    if (force) {
      throw new CrudHttpError(400, { error: 'sales.orders.activateOfferings.missingScope' })
    }
    return empty
  }

  const em = ctx.resolve<EntityManager>('em').fork()
  if (!force) {
    const activationStatuses = await loadActivationStatuses(em, tenantId, organizationId)
    if (!isSubscriptionActivationOrderStatus(payload.status, activationStatuses)) {
      const orderProbe = await em.findOne(SalesOrder, { id: orderId, deletedAt: null })
      if (!isSubscriptionActivationOrderStatus(orderProbe?.status, activationStatuses)) return empty
    }
  }

  const order = await em.findOne(
    SalesOrder,
    { id: orderId, tenantId, organizationId, deletedAt: null },
    { populate: ['lines'] },
  )
  if (!order) {
    if (force) throw new CrudHttpError(404, { error: 'sales.orders.activateOfferings.notFound' })
    return empty
  }
  if (!force) {
    const activationStatuses = await loadActivationStatuses(em, tenantId, organizationId)
    if (!isSubscriptionActivationOrderStatus(order.status, activationStatuses)) return empty
  }

  const customerEntityId = order.customerEntityId?.trim()
  if (!customerEntityId) {
    if (force) {
      throw new CrudHttpError(400, { error: 'sales.orders.activateOfferings.customerRequired' })
    }
    return empty
  }

  const customer = await findOneWithDecryption(
    em,
    CustomerEntity,
    { id: customerEntityId, deletedAt: null },
    undefined,
    { tenantId, organizationId },
  )
  if (!customer) {
    if (force) {
      throw new CrudHttpError(400, { error: 'sales.orders.activateOfferings.customerRequired' })
    }
    return empty
  }

  const lines = await em.find(SalesOrderLine, {
    order: order.id,
    tenantId,
    organizationId,
    deletedAt: null,
  })

  const commandCtx =
    options?.commandCtx ?? buildCommandCtx(ctx, tenantId, organizationId)

  let processedLines = 0
  let activatedOfferings = 0
  let spawnedCaseCount = 0
  const lineErrors: string[] = []

  for (const line of lines) {
    const productId = line.productId?.trim()
    if (!productId) continue
    const product = await em.findOne(CatalogProduct, {
      id: productId,
      tenantId,
      organizationId,
      deletedAt: null,
    })
    if (!product) continue

    const isSubscription = await isSubscriptionProduct(em, product.id)
    if (isSubscription) {
      if (!line.subscriptionStartsAt || !line.subscriptionEndsAt) {
        console.error(
          '[catalog:sales-order-confirmed-offerings] Subscription line missing dates',
          { orderId, lineId: line.id },
        )
        if (force) {
          lineErrors.push(line.id)
        }
        continue
      }
    }

    try {
      const offering = await upsertCustomerOfferingFromOrderLine(em, {
        tenantId,
        organizationId,
        customerEntityId,
        product,
        salesOrderId: order.id,
        salesOrderLineId: line.id,
        subscriptionStartsAt: line.subscriptionStartsAt ?? null,
        subscriptionEndsAt: line.subscriptionEndsAt ?? null,
        casePlan: (line.casePlan ?? null) as CatalogProductCaseTemplate[] | null,
      })
      processedLines += 1
      const parentResult = await activateIfReady(em, commandCtx, offering, { force })
      if (parentResult.activated) activatedOfferings += 1
      spawnedCaseCount += parentResult.spawnedCaseCount

      const children = await expandBundleChildProducts(em, product)
      for (const child of children) {
        const childIsSubscription = await isSubscriptionProduct(em, child.id)
        if (childIsSubscription) {
          if (!line.subscriptionStartsAt || !line.subscriptionEndsAt) continue
        }
        const childOffering = await upsertCustomerOfferingFromOrderLine(em, {
          tenantId,
          organizationId,
          customerEntityId,
          product: child,
          salesOrderId: order.id,
          salesOrderLineId: line.id,
          subscriptionStartsAt: line.subscriptionStartsAt ?? null,
          subscriptionEndsAt: line.subscriptionEndsAt ?? null,
          casePlan: (child.caseTemplates ?? null) as CatalogProductCaseTemplate[] | null,
          parentOfferingId: offering.id,
        })
        const childResult = await activateIfReady(em, commandCtx, childOffering, { force })
        if (childResult.activated) activatedOfferings += 1
        spawnedCaseCount += childResult.spawnedCaseCount
      }
    } catch (err) {
      console.error('[catalog:sales-order-confirmed-offerings] Failed for line', line.id, err)
      if (force) {
        if (err instanceof CrudHttpError) throw err
        lineErrors.push(line.id)
      }
    }
  }

  if (force && processedLines === 0) {
    throw new CrudHttpError(400, {
      error:
        lineErrors.length > 0
          ? 'sales.orders.activateOfferings.subscriptionDatesRequired'
          : 'sales.orders.activateOfferings.noLines',
    })
  }

  return { processedLines, activatedOfferings, spawnedCaseCount }
}
