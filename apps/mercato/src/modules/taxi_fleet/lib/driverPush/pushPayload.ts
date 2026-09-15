export type DriverPushKind =
  | 'trip_assigned'
  | 'trip_reminder'
  | 'assignment_planned'
  | 'settlement_ready'
  | 'monthly_settlement_ready'
  | 'driver_broadcast'

export type DriverPushPayload = {
  kind: DriverPushKind
  tripId?: string
  communicationId?: string
  recipientId?: string
  url: string
  title: string
  body: string
  tag: string
  urgency?: 'normal' | 'high'
}

/** Maps push kind → notification preference type for shouldDeliverPush. */
export function preferenceTypeForPushKind(kind: DriverPushKind): string {
  switch (kind) {
    case 'trip_assigned':
      return 'taxi_fleet.trip.assigned'
    case 'trip_reminder':
      return 'taxi_fleet.trip.reminder'
    case 'assignment_planned':
      return 'taxi_fleet.assignment.planned'
    case 'settlement_ready':
      return 'taxi_fleet.settlement.ready'
    case 'monthly_settlement_ready':
      return 'taxi_fleet.monthly_settlement.ready'
    case 'driver_broadcast':
      return 'taxi_fleet.driver_broadcast'
  }
}

export function buildDriverTripPushUrl(tripId: string): string {
  return `/driver/trips/${encodeURIComponent(tripId)}`
}

export function buildDriverAssignmentPushUrl(): string {
  return '/driver/assignments'
}

export function buildDriverSettlementPushUrl(settlementId: string): string {
  return `/driver/settlements/${encodeURIComponent(settlementId)}`
}

export function buildDriverMonthlySettlementPushUrl(settlementId: string): string {
  return `/driver/monthly-settlements/${encodeURIComponent(settlementId)}`
}

export function buildDriverPushTag(kind: DriverPushKind, entityId: string): string {
  return `taxi_fleet:${kind}:${entityId}`
}
