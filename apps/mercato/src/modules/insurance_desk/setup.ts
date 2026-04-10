import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: ['insurance_desk.access', 'insurance.*'],
    employee: [
      'insurance_desk.access',
      'insurance.insurers.view',
      'insurance.insurer_contacts.view',
      'insurance.policies.view',
      'insurance.leads.view',
    ],
  },
}

export default setup
