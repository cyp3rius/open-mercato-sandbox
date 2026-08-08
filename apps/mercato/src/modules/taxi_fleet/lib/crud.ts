import type { CrudEventsConfig } from '@open-mercato/shared/lib/crud/types'
import type {
  TaxiFleetDailyAssignment,
  TaxiFleetDriverProfile,
  TaxiFleetTrip,
  TaxiFleetWeeklySettlement,
} from '../data/entities'

function buildCrudEvents<TEntity>(entity: string): CrudEventsConfig<TEntity> {
  return {
    module: 'taxi_fleet',
    entity,
    persistent: true,
    buildPayload: (ctx) => ({
      id: ctx.identifiers.id,
      organizationId: ctx.identifiers.organizationId,
      tenantId: ctx.identifiers.tenantId,
    }),
  }
}

export const driverProfileCrudEvents = buildCrudEvents<TaxiFleetDriverProfile>('driver_profile')
export const assignmentCrudEvents = buildCrudEvents<TaxiFleetDailyAssignment>('assignment')
export const tripCrudEvents = buildCrudEvents<TaxiFleetTrip>('trip')
export const settlementCrudEvents = buildCrudEvents<TaxiFleetWeeklySettlement>('settlement')
