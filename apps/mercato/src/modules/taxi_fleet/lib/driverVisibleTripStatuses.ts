import { normalizeTripStatus } from './tripStatuses'

/** Statuses the driver app may list/open. CRM pipeline statuses stay out of the driver PWA. */
export const DRIVER_VISIBLE_TRIP_STATUSES = ['scheduled', 'in_progress', 'completed'] as const

export type DriverVisibleTripStatus = (typeof DRIVER_VISIBLE_TRIP_STATUSES)[number]

const DRIVER_VISIBLE_SET = new Set<string>(DRIVER_VISIBLE_TRIP_STATUSES)

export function isDriverVisibleTripStatus(status: string | null | undefined): boolean {
  return DRIVER_VISIBLE_SET.has(normalizeTripStatus(status))
}
