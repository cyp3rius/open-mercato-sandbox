import { normalizeTripStatus } from './tripStatuses'

/** Statuses the driver app may list/open. CRM pipeline statuses stay out of the driver PWA. */
export const DRIVER_VISIBLE_TRIP_STATUSES = [
  'scheduled',
  'in_progress',
  'pending_authorization',
  'completed',
] as const

export type DriverVisibleTripStatus = (typeof DRIVER_VISIBLE_TRIP_STATUSES)[number]

const DRIVER_VISIBLE_SET = new Set<string>(DRIVER_VISIBLE_TRIP_STATUSES)

export function isDriverVisibleTripStatus(status: string | null | undefined): boolean {
  return DRIVER_VISIBLE_SET.has(normalizeTripStatus(status))
}

/**
 * Driver-facing status: pending authorization is finished from the driver's POV
 * (CRM still sees pending_authorization for authorization workflow).
 */
export function resolveDriverFacingTripStatus(status: string | null | undefined): string {
  const normalized = normalizeTripStatus(status)
  if (normalized === 'pending_authorization') return 'completed'
  return normalized
}

/** Finished / locked for driver edits (including receipt-only supplement rules). */
export function isDriverTripFinishedStatus(status: string | null | undefined): boolean {
  const normalized = normalizeTripStatus(status)
  return normalized === 'completed' || normalized === 'pending_authorization'
}
