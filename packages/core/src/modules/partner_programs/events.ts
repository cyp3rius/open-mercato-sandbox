import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'partner_programs.program.created', label: 'Partner program created', entity: 'program', category: 'crud' },
  { id: 'partner_programs.program.updated', label: 'Partner program updated', entity: 'program', category: 'crud' },
  { id: 'partner_programs.program.deleted', label: 'Partner program deleted', entity: 'program', category: 'crud' },
  {
    id: 'partner_programs.membership.created',
    label: 'Partner program membership created',
    entity: 'membership',
    category: 'crud',
  },
  {
    id: 'partner_programs.membership.deleted',
    label: 'Partner program membership deleted',
    entity: 'membership',
    category: 'crud',
  },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'partner_programs',
  events,
})

export default eventsConfig
