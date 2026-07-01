import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'procurement.process.created', label: 'Procurement process created', entity: 'process', category: 'crud' },
  { id: 'procurement.process.updated', label: 'Procurement process updated', entity: 'process', category: 'crud' },
  { id: 'procurement.process.deleted', label: 'Procurement process deleted', entity: 'process', category: 'crud' },
  {
    id: 'procurement.process_supplier.created',
    label: 'Procurement supplier added',
    entity: 'process_supplier',
    category: 'crud',
  },
  {
    id: 'procurement.process_supplier.updated',
    label: 'Procurement supplier updated',
    entity: 'process_supplier',
    category: 'crud',
  },
  {
    id: 'procurement.process_supplier.deleted',
    label: 'Procurement supplier removed',
    entity: 'process_supplier',
    category: 'crud',
  },
  {
    id: 'procurement.process_line_item.created',
    label: 'Procurement line item created',
    entity: 'process_line_item',
    category: 'crud',
  },
  {
    id: 'procurement.process_line_item.updated',
    label: 'Procurement line item updated',
    entity: 'process_line_item',
    category: 'crud',
  },
  {
    id: 'procurement.process_line_item.deleted',
    label: 'Procurement line item deleted',
    entity: 'process_line_item',
    category: 'crud',
  },
  {
    id: 'procurement.process_task.created',
    label: 'Procurement task created',
    entity: 'process_task',
    category: 'crud',
  },
  {
    id: 'procurement.process_task.updated',
    label: 'Procurement task updated',
    entity: 'process_task',
    category: 'crud',
  },
  {
    id: 'procurement.process_task.deleted',
    label: 'Procurement task deleted',
    entity: 'process_task',
    category: 'crud',
  },
  {
    id: 'procurement.process_task.assigned',
    label: 'Procurement task assigned',
    entity: 'process_task',
    category: 'crud',
  },
  {
    id: 'procurement.process_task.completed',
    label: 'Procurement task completed',
    entity: 'process_task',
    category: 'lifecycle',
  },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'procurement',
  events,
})

export default eventsConfig
