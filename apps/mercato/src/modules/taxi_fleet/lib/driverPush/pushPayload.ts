export type DriverPushKind = 'trip_assigned' | 'trip_reminder'

export type DriverPushPayload = {
  kind: DriverPushKind
  tripId: string
  url: string
  title: string
  body: string
  tag: string
}

export function buildDriverTripPushUrl(tripId: string): string {
  return `/driver/trips/${encodeURIComponent(tripId)}`
}

export function buildDriverPushTag(kind: DriverPushKind, tripId: string): string {
  return `taxi_fleet:${kind}:${tripId}`
}
