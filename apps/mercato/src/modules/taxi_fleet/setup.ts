import type { EntityManager } from '@mikro-orm/postgresql'
import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import { Role } from '@open-mercato/core/modules/auth/data/entities'
import { syncTaxiVehicleCustomFieldScope } from './lib/vehicleResourceTypes'
import { ensureTaxiFleetDriverReceiptsPartition } from './lib/receiptPartition'

const DRIVER_ROLE_NAME = 'driver'

async function ensureDriverRole(em: EntityManager, tenantId: string): Promise<void> {
  const existing = await em.findOne(Role, { name: DRIVER_ROLE_NAME, tenantId })
  if (existing) return
  const globalRole = await em.findOne(Role, { name: DRIVER_ROLE_NAME, tenantId: null })
  if (globalRole) {
    globalRole.tenantId = tenantId
    em.persist(globalRole)
    return
  }
  em.persist(em.create(Role, { name: DRIVER_ROLE_NAME, tenantId, createdAt: new Date() }))
}

export const setup: ModuleSetupConfig = {
  async onTenantCreated({ em, tenantId }) {
    await ensureDriverRole(em as EntityManager, tenantId)
    await ensureTaxiFleetDriverReceiptsPartition(em as EntityManager)
  },

  seedDefaults: async (ctx) => {
    await ensureDriverRole(ctx.em as EntityManager, ctx.tenantId)
    await ensureTaxiFleetDriverReceiptsPartition(ctx.em as EntityManager)
    await syncTaxiVehicleCustomFieldScope(ctx.em, {
      tenantId: ctx.tenantId,
      organizationId: ctx.organizationId,
    })
  },

  defaultRoleFeatures: {
    admin: ['taxi_fleet.*'],
    employee: [
      'taxi_fleet.view',
      'taxi_fleet.manage_assignments',
      'taxi_fleet.manage_trips',
      'taxi_fleet.trips.inject',
      'taxi_fleet.manage_settlements',
      'taxi_fleet.settings.manage',
      'taxi_fleet.trip.order.notify',
      'taxi_fleet.trip.paid.notify',
      'taxi_fleet.trip.confirmed.notify',
      'taxi_fleet.trip.cancelled.notify',
      'taxi_fleet.trip.submitted.notify',
      'taxi_fleet.financial.income.notify',
      'taxi_fleet.financial.expense.notify',
      'taxi_fleet.settlement.submitted.notify',
    ],
    driver: ['taxi_fleet.view', 'taxi_fleet.driver'],
  },
}

export default setup
