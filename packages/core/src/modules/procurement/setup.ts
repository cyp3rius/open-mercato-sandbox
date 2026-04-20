import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import { seedProcurementDictionaries } from './lib/seeds'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['procurement.*'],
    employee: ['procurement.processes.view', 'procurement.processes.manage'],
  },
  async seedDefaults({ em, tenantId, organizationId }) {
    await seedProcurementDictionaries(em, { tenantId, organizationId })
  },
}

export default setup
