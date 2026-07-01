import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'insurance.insurer.created', label: 'Insurer created', entity: 'insurer', category: 'crud' },
  { id: 'insurance.insurer.updated', label: 'Insurer updated', entity: 'insurer', category: 'crud' },
  { id: 'insurance.insurer.deleted', label: 'Insurer deleted', entity: 'insurer', category: 'crud' },
  {
    id: 'insurance.insurer_contact.created',
    label: 'Insurer contact created',
    entity: 'insurer_contact',
    category: 'crud',
  },
  {
    id: 'insurance.insurer_contact.updated',
    label: 'Insurer contact updated',
    entity: 'insurer_contact',
    category: 'crud',
  },
  {
    id: 'insurance.insurer_contact.deleted',
    label: 'Insurer contact deleted',
    entity: 'insurer_contact',
    category: 'crud',
  },
  { id: 'insurance.policy.created', label: 'Policy created', entity: 'policy', category: 'crud' },
  { id: 'insurance.policy.updated', label: 'Policy updated', entity: 'policy', category: 'crud' },
  { id: 'insurance.policy.deleted', label: 'Policy deleted', entity: 'policy', category: 'crud' },
  {
    id: 'insurance.policy.signing.case_ensured',
    label: 'Policy signing case ensured (workflow)',
    entity: 'policy',
    category: 'lifecycle',
  },
  { id: 'insurance.lead.created', label: 'Lead created', entity: 'lead', category: 'crud' },
  { id: 'insurance.lead.updated', label: 'Lead updated', entity: 'lead', category: 'crud' },
  { id: 'insurance.lead.deleted', label: 'Lead deleted', entity: 'lead', category: 'crud' },
  {
    id: 'insurance.policy.created_from_lead',
    label: 'Policy created from lead',
    entity: 'policy',
    category: 'lifecycle',
  },
  {
    id: 'insurance.policy.expiring',
    label: 'Policy expiring soon',
    entity: 'policy',
    category: 'lifecycle',
  },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'insurance',
  events,
})

export default eventsConfig
