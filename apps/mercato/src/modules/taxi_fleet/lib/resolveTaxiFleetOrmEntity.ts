import { getOrmEntities } from '@open-mercato/shared/lib/db/mikro'
import type { TaxiFleetOrganizationSettings } from '../data/entities'

export function resolveTaxiFleetOrganizationSettingsEntity(): typeof TaxiFleetOrganizationSettings {
  const registered = getOrmEntities().find((entity) => entity?.name === 'TaxiFleetOrganizationSettings')
  if (registered) {
    return registered as typeof TaxiFleetOrganizationSettings
  }
  throw new Error(
    'TaxiFleetOrganizationSettings is not registered with MikroORM. Restart the dev server after adding module entities.',
  )
}
