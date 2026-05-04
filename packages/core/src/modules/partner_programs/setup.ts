import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['partner_programs.*'],
    employee: ['partner_programs.view', 'partner_programs.manage_memberships'],
  },
}

export default setup
