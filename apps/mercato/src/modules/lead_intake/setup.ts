import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['lead_intake.submit', 'lead_intake.deals.inject', 'lead_intake.deals.inject.notify'],
  },
}

export default setup
