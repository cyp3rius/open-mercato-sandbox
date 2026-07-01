import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['cases.*'],
    employee: [
      'cases.view',
      'cases.create',
      'cases.cases.create.notify',
      'cases.edit',
      'cases.close',
      'messages.view',
      'attachments.view',
      'attachments.manage',
    ],
  },
}

export default setup
