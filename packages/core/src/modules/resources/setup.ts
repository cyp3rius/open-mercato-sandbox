import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import {
  seedResourcesAddressTypes,
  seedResourcesCapacityUnits,
  seedResourcesResourceExamples,
  seedResourcesResourceStatus,
} from './lib/seeds'

export const setup: ModuleSetupConfig = {
  seedDefaults: async (ctx) => {
    const scope = { tenantId: ctx.tenantId, organizationId: ctx.organizationId }
    await seedResourcesAddressTypes(ctx.em, scope)
    await seedResourcesResourceStatus(ctx.em, scope)
  },

  seedExamples: async (ctx) => {
    const scope = { tenantId: ctx.tenantId, organizationId: ctx.organizationId }
    await seedResourcesCapacityUnits(ctx.em, scope)
    await seedResourcesResourceExamples(ctx.em, scope)
  },

  defaultRoleFeatures: {
    admin: ['resources.*'],
  },
}

export default setup
