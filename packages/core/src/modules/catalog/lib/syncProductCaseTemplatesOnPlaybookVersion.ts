import type { EntityManager } from '@mikro-orm/postgresql'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import type { CrudEventsConfig, CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { E } from '#generated/entities.ids.generated'
import { Playbook } from '../../playbooks/data/entities'
import { CatalogProduct } from '../data/entities'
import { rewriteProductCaseTemplatePlaybooks } from './rewriteProductCaseTemplatePlaybooks'

export type PlaybookVersionPublishedPayload = {
  playbookId?: string
  slug?: string
  title?: string
  version?: number
  tenantId?: string
  organizationId?: string
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export type SyncProductCaseTemplatesResult = {
  scannedProducts: number
  updatedProducts: number
}

const productCrudEvents: CrudEventsConfig<CatalogProduct> = {
  module: 'catalog',
  entity: 'product',
  persistent: true,
  buildPayload: (ctx) => ({
    id: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
    productType: ctx.entity.productType,
    statusEntryId: ctx.entity.statusEntryId ?? null,
    isActive: ctx.entity.isActive,
  }),
}

const productCrudIndexer: CrudIndexerConfig<CatalogProduct> = {
  entityType: E.catalog.catalog_product,
  buildUpsertPayload: (ctx) => ({
    entityType: E.catalog.catalog_product,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
  buildDeletePayload: (ctx) => ({
    entityType: E.catalog.catalog_product,
    recordId: ctx.identifiers.id,
    tenantId: ctx.identifiers.tenantId,
    organizationId: ctx.identifiers.organizationId,
  }),
}

function normalizeId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * When a playbook version is published, rewrite live product case templates
 * that still reference older version UUIDs for the same slug to the new head id.
 */
export async function syncProductCaseTemplatesOnPlaybookVersion(
  payload: PlaybookVersionPublishedPayload,
  ctx: ResolverContext,
): Promise<SyncProductCaseTemplatesResult> {
  const playbookId = normalizeId(payload.playbookId)
  const slug = normalizeId(payload.slug).toLowerCase()
  const tenantId = normalizeId(payload.tenantId)
  const organizationId = normalizeId(payload.organizationId)
  if (!playbookId || !slug || !tenantId || !organizationId) {
    return { scannedProducts: 0, updatedProducts: 0 }
  }

  const em = (ctx.resolve('em') as EntityManager).fork()
  const versions = await em.find(Playbook, {
    tenantId,
    organizationId,
    slug,
    deletedAt: null,
  })
  if (!versions.length) {
    return { scannedProducts: 0, updatedProducts: 0 }
  }

  const fromPlaybookIds = new Set(
    versions.map((row) => row.id).filter((id) => id !== playbookId),
  )
  if (!fromPlaybookIds.size) {
    return { scannedProducts: 0, updatedProducts: 0 }
  }

  const products = await em.find(CatalogProduct, {
    tenantId,
    organizationId,
    deletedAt: null,
  })

  const updated: CatalogProduct[] = []
  const now = new Date()
  let scannedProducts = 0
  for (const product of products) {
    if (!Array.isArray(product.caseTemplates) || product.caseTemplates.length === 0) {
      continue
    }
    scannedProducts += 1
    const result = rewriteProductCaseTemplatePlaybooks(
      product.caseTemplates,
      fromPlaybookIds,
      playbookId,
    )
    if (!result.changed) continue
    product.caseTemplates = result.next
    product.updatedAt = now
    updated.push(product)
  }

  if (!updated.length) {
    return { scannedProducts, updatedProducts: 0 }
  }

  await em.flush()

  const dataEngine = ctx.resolve('dataEngine') as DataEngine
  for (const product of updated) {
    await emitCrudSideEffects({
      dataEngine,
      action: 'updated',
      entity: product,
      identifiers: {
        id: product.id,
        organizationId: product.organizationId,
        tenantId: product.tenantId,
      },
      events: productCrudEvents,
      indexer: productCrudIndexer,
    })
  }

  return {
    scannedProducts,
    updatedProducts: updated.length,
  }
}
