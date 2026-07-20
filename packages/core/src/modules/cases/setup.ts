import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'
import { registerCasesSchedules } from './lib/registerCasesSchedules'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['cases.*'],
    employee: [
      'cases.view',
      'cases.create',
      'cases.cases.create.notify',
      'cases.cases.overdue.notify',
      'cases.cases.closed.notify',
      'cases.edit',
      'cases.close',
      'messages.view',
      'attachments.view',
      'attachments.manage',
    ],
  },
  async seedDefaults({ container, tenantId, organizationId }) {
    await registerCasesSchedules(container, { tenantId, organizationId })
  },
}

export default setup
