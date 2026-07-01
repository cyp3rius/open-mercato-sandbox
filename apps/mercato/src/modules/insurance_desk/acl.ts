export const features = [
  { id: 'insurance_desk.access', title: 'Insurance desk', module: 'insurance_desk' },
  {
    id: 'insurance_desk.leads.inject',
    title: 'Inject insurance leads from external channels',
    module: 'insurance_desk',
  },
  {
    id: 'insurance_desk.leads.inject.notify',
    title: 'Receive notifications for injected insurance inquiries',
    module: 'insurance_desk',
  },
  {
    id: 'insurance_desk.policies.from_enquiry.notify',
    title: 'Receive notifications when a policy is created from an inquiry',
    module: 'insurance_desk',
  },
  {
    id: 'insurance_desk.policies.expiring.notify',
    title: 'Receive notifications for any policy nearing expiry',
    module: 'insurance_desk',
  },
]

export default features
