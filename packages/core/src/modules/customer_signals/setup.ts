import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['customer_signals.*'],
    employee: ['customer_signals.view', 'customer_signals.ingest'],
  },
}

export default setup
