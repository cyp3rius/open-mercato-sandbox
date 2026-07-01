import type { ModuleSetupConfig } from '@open-mercato/shared/modules/setup'

export const setup: ModuleSetupConfig = {
  defaultRoleFeatures: {
    admin: [
      'insurance_desk.access',
      'insurance_desk.leads.inject',
      'insurance_desk.leads.inject.notify',
      'insurance_desk.policies.from_enquiry.notify',
      'insurance_desk.policies.expiring.notify',
      'insurance.*',
    ],
    employee: [
      'insurance_desk.access',
      'insurance_desk.leads.inject.notify',
      'insurance_desk.policies.from_enquiry.notify',
      'insurance_desk.policies.expiring.notify',
      'insurance.insurers.view',
      'insurance.insurer_contacts.view',
      'insurance.policies.view',
      'insurance.leads.view',
    ],
  },
}

export default setup
