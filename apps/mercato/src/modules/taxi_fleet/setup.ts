import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import { syncTaxiVehicleCustomFieldScope } from './lib/vehicleResourceTypes'

export const setup: ModuleSetupConfig = {
  seedDefaults: async (ctx) => {
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
