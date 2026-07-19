import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'cases.case.created', label: 'Case created', entity: 'case', category: 'crud' },
  { id: 'cases.case.closed', label: 'Case closed', entity: 'case', category: 'crud' },
  { id: 'cases.case.overdue', label: 'Case overdue', entity: 'case', category: 'lifecycle' },
  { id: 'cases.case.stage_owner_assigned', label: 'Case stage owner assigned', entity: 'case', category: 'lifecycle' },
  { id: 'cases.timeline.appended', label: 'Case timeline event added', entity: 'case', category: 'crud' },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'cases',
  events,
})

export default eventsConfig
