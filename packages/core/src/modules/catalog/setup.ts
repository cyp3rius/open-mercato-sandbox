import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import { seedCatalogUnits, seedCatalogPriceKinds, seedCatalogServiceLines, seedCatalogExamplesForScope } from './lib/seeds'
import { registerCatalogSubscriptionSchedule } from './lib/registerCatalogSubscriptionSchedule'

export const setup: ModuleSetupConfig = {
  seedDefaults: async (ctx) => {
    const scope = { tenantId: ctx.tenantId, organizationId: ctx.organizationId }
    await seedCatalogUnits(ctx.em, scope)
    await seedCatalogPriceKinds(ctx.em, scope)
    await seedCatalogServiceLines(ctx.em, scope)
    await registerCatalogSubscriptionSchedule(ctx.container, scope)
  },

  seedExamples: async (ctx) => {
    const scope = { tenantId: ctx.tenantId, organizationId: ctx.organizationId }
    await seedCatalogExamplesForScope(ctx.em, ctx.container, scope)
  },

  defaultRoleFeatures: {
    admin: ['catalog.*', 'catalog.variants.manage', 'catalog.pricing.manage'],
    employee: [
      'catalog.products.view',
      'catalog.serviceLines.view',
      'catalog.products.manage',
      'catalog.categories.view',
      'catalog.categories.manage',
      'catalog.variants.manage',
      'catalog.pricing.manage',
      'catalog.customer_offerings.view',
      'catalog.customer_offerings.manage',
      'catalog.simple_offerings.view',
      'catalog.simple_offerings.manage',
    ],
  },
}

export default setup
