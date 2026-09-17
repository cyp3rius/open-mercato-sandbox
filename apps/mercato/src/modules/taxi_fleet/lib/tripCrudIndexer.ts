import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import type { CrudIndexerConfig } from '@open-mercato/shared/lib/crud/types'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { E } from '@/.mercato/generated/entities.ids.generated'
import type { TaxiFleetTrip } from '../data/entities'

export const tripCrudIndexer: CrudIndexerConfig<TaxiFleetTrip> = {
  entityType: E.taxi_fleet.taxi_fleet_trip,
}

type EmitCtx = {
  container: {
    resolve: (name: string) => unknown
  }
}

export async function emitTripIndexerSideEffects(
  ctx: EmitCtx,
  action: 'created' | 'updated' | 'deleted',
  trip: TaxiFleetTrip,
): Promise<void> {
  let dataEngine: DataEngine
  try {
    dataEngine = ctx.container.resolve('dataEngine') as DataEngine
  } catch {
    return
  }
  await emitCrudSideEffects({
    dataEngine,
    action,
    entity: trip,
    identifiers: {
      id: trip.id,
      organizationId: trip.organizationId,
      tenantId: trip.tenantId,
    },
    indexer: tripCrudIndexer,
  })
}
