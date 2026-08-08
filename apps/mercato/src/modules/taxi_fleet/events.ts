import { createModuleEvents } from '@open-mercato/shared/modules/events'

const events = [
  { id: 'taxi_fleet.assignment.created', label: 'Daily assignment created', entity: 'assignment', category: 'crud' },
  { id: 'taxi_fleet.assignment.updated', label: 'Daily assignment updated', entity: 'assignment', category: 'crud' },
  { id: 'taxi_fleet.trip.created', label: 'Trip order created', entity: 'trip', category: 'lifecycle', persistent: true },
  { id: 'taxi_fleet.trip.assigned', label: 'Trip assigned to driver', entity: 'trip', category: 'lifecycle', persistent: true },
  { id: 'taxi_fleet.trip.paid', label: 'Trip paid by customer', entity: 'trip', category: 'lifecycle', persistent: true },
  { id: 'taxi_fleet.trip.submitted', label: 'Trip submitted by driver', entity: 'trip', category: 'lifecycle', persistent: true },
  { id: 'taxi_fleet.trip.approved', label: 'Trip approved', entity: 'trip', category: 'lifecycle', persistent: true },
  { id: 'taxi_fleet.trip.cancelled', label: 'Trip cancelled', entity: 'trip', category: 'lifecycle', persistent: true },
  { id: 'taxi_fleet.financial_entry.created', label: 'Financial entry created', entity: 'financial_entry', category: 'crud', persistent: true },
  { id: 'taxi_fleet.settlement.submitted', label: 'Weekly settlement submitted', entity: 'settlement', category: 'lifecycle', persistent: true },
  { id: 'taxi_fleet.settlement.approved', label: 'Weekly settlement approved', entity: 'settlement', category: 'lifecycle', persistent: true },
] as const

export const eventsConfig = createModuleEvents({
  moduleId: 'taxi_fleet',
  events,
})

export default eventsConfig
