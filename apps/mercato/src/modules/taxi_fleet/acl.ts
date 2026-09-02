export const features = [
  { id: 'taxi_fleet.view', title: 'View taxi fleet', module: 'taxi_fleet' },
  { id: 'taxi_fleet.manage_assignments', title: 'Manage daily assignments', module: 'taxi_fleet' },
  { id: 'taxi_fleet.manage_trips', title: 'Manage and approve trips', module: 'taxi_fleet' },
  { id: 'taxi_fleet.trips.inject', title: 'Inject trips from external channels', module: 'taxi_fleet' },
  { id: 'taxi_fleet.manage_settlements', title: 'Manage weekly settlements', module: 'taxi_fleet' },
  { id: 'taxi_fleet.manage_platform_sync', title: 'Sync platform trips (Bolt/Uber/Free)', module: 'taxi_fleet' },
  { id: 'taxi_fleet.settings.manage', title: 'Manage taxi fleet module settings', module: 'taxi_fleet' },
  { id: 'taxi_fleet.driver', title: 'Driver mobile app API', module: 'taxi_fleet' },
  { id: 'taxi_fleet.trip.order.notify', title: 'Notify on every new trip order', module: 'taxi_fleet' },
  { id: 'taxi_fleet.trip.paid.notify', title: 'Notify when trip is paid by customer', module: 'taxi_fleet' },
  { id: 'taxi_fleet.trip.confirmed.notify', title: 'Notify when operator confirms trip', module: 'taxi_fleet' },
  { id: 'taxi_fleet.trip.cancelled.notify', title: 'Notify when trip is cancelled', module: 'taxi_fleet' },
  { id: 'taxi_fleet.trip.submitted.notify', title: 'Notify when driver submits trip', module: 'taxi_fleet' },
  { id: 'taxi_fleet.financial.income.notify', title: 'Notify on registered invoice/receipt', module: 'taxi_fleet' },
  { id: 'taxi_fleet.financial.expense.notify', title: 'Notify on registered cost', module: 'taxi_fleet' },
  { id: 'taxi_fleet.settlement.submitted.notify', title: 'Notify when driver submits settlement', module: 'taxi_fleet' },
  { id: 'taxi_fleet.platform_sync.notify', title: 'Notify when platform CSV/API sync finishes', module: 'taxi_fleet' },
]

export default features
