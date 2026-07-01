import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'playbooks.playbook.created', label: 'Playbook created', entity: 'playbook', category: 'crud' },
  {
    id: 'playbooks.playbook.version_published',
    label: 'Playbook version published',
    entity: 'playbook',
    category: 'lifecycle',
  },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'playbooks',
  events,
})

export default eventsConfig
