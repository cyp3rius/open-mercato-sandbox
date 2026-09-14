/**
 * Platform import (CSV / API sync) only keeps realized trips.
 * Cancelled vendor rows are dropped — they never become CRM trips.
 */
export function isCancelledPlatformImportStatus(value: string | null | undefined): boolean {
  const normalized = (value ?? '').trim().toLowerCase()
  if (!normalized) return false
  return (
    normalized === 'cancelled' ||
    normalized === 'canceled' ||
    normalized === 'rider_cancelled' ||
    normalized === 'rider_canceled' ||
    normalized === 'driver_cancelled' ||
    normalized === 'driver_canceled' ||
    normalized.includes('cancel')
  )
}

export function isRealizedPlatformImportStatus(
  status: 'completed' | 'cancelled' | 'paid' | string | null | undefined,
): boolean {
  if (status == null) return false
  const normalized = String(status).trim().toLowerCase()
  return normalized === 'completed' || normalized === 'paid'
}
