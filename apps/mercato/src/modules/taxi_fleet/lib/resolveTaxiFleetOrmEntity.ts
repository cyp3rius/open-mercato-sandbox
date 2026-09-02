import { getOrmEntities } from '@open-mercato/shared/lib/db/mikro'
import type { TaxiFleetOrganizationSettings, TaxiFleetPlatformSyncRun } from '../data/entities'

function resolveTaxiFleetEntity<T>(entityName: string): T {
  const registered = getOrmEntities().find((entity) => entity?.name === entityName)
  if (registered) {
    return registered as T
  }
  throw new Error(
    `${entityName} is not registered with MikroORM. Restart the dev server after adding module entities.`,
  )
}

export function resolveTaxiFleetOrganizationSettingsEntity(): typeof TaxiFleetOrganizationSettings {
  return resolveTaxiFleetEntity('TaxiFleetOrganizationSettings')
}

export function resolveTaxiFleetPlatformSyncRunEntity(): typeof TaxiFleetPlatformSyncRun {
  return resolveTaxiFleetEntity('TaxiFleetPlatformSyncRun')
}
