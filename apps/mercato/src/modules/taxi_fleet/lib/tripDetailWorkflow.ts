import { normalizeTripStatus } from './tripStatuses'

export type TripDetailActionId = 'approve' | 'reject' | 'schedule' | 'mark_paid' | 'complete'

export type TripDetailLockMode = 'none' | 'full' | 'status_only' | 'paid_partial'

const PAID_EDITABLE_FIELD_IDS = new Set([
  'teamMemberId',
  'resourceId',
  'status',
  'revenueAmount',
  'vehicleCategory',
  'basePrice',
  '__tripPricingSidebar',
  '__tripQuoteSummary',
])

export function tripDetailActionsForStatus(status: string): TripDetailActionId[] {
  switch (normalizeTripStatus(status)) {
    case 'new':
      return ['approve', 'reject']
    case 'approved':
      return ['schedule', 'mark_paid']
    case 'scheduled':
      return ['complete']
    case 'paid':
      return ['schedule', 'complete']
    default:
      return []
  }
}

export type TripDetailLockOptions = {
  /** When true, completed trips are fully editable (cancelled stays locked). */
  allowEditCompleted?: boolean
}

export function tripDetailLockMode(
  status: string,
  options?: TripDetailLockOptions,
): TripDetailLockMode {
  switch (normalizeTripStatus(status)) {
    case 'cancelled':
      return 'full'
    case 'completed':
      return options?.allowEditCompleted ? 'none' : 'full'
    case 'scheduled':
      return 'status_only'
    case 'paid':
      return 'paid_partial'
    default:
      return 'none'
  }
}

export function isTripDetailFieldEditable(
  status: string,
  fieldId: string,
  options?: TripDetailLockOptions,
): boolean {
  const mode = tripDetailLockMode(status, options)
  if (mode === 'none') return true
  if (mode === 'full') return false
  if (mode === 'status_only') return fieldId === 'status'
  return PAID_EDITABLE_FIELD_IDS.has(fieldId)
}

export function tripDetailAllowsDriverEdit(status: string): boolean {
  return tripDetailLockMode(status) === 'paid_partial'
}

export function isCompletedTripStatus(status: string): boolean {
  return normalizeTripStatus(status) === 'completed'
}
