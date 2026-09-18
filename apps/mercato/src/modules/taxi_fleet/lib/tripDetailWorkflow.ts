import { normalizeTripStatus } from './tripStatuses'
import { resolveDriverTripFinishStatus } from './driverTripCommercialFields'

export type TripDetailActionId =
  | 'approve'
  | 'reject'
  | 'schedule'
  | 'mark_paid'
  | 'complete'
  | 'authorize_internal'
  | 'cancel'

/** Status written by each detail-header shortcut (after form save). */
export function tripDetailActionTargetStatus(action: TripDetailActionId): string {
  switch (action) {
    case 'approve':
      return 'approved'
    case 'reject':
    case 'cancel':
      return 'cancelled'
    case 'schedule':
      return 'scheduled'
    case 'mark_paid':
      return 'paid'
    case 'complete':
      return 'completed'
    case 'authorize_internal':
      return 'completed'
    default:
      return 'new'
  }
}

/** Ready-for-fulfillment requires an assigned driver (and vehicle when present in form). */
export function tripHasDriverForSchedule(values: {
  teamMemberId?: string | null
  resourceId?: string | null
}): boolean {
  const driver = typeof values.teamMemberId === 'string' ? values.teamMemberId.trim() : ''
  return Boolean(driver)
}

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

/** Fields that must stay untouched for a completed-trip receipt supplement. */
const RECEIPT_SUPPLEMENT_DISALLOWED_UPDATE_KEYS = [
  'teamMemberId',
  'resourceId',
  'assignmentId',
  'tripType',
  'platform',
  'startedAt',
  'endedAt',
  'odometerStart',
  'odometerEnd',
  'distanceKm',
  'revenueAmount',
  'currencyCode',
  'customerPersonId',
  'customerCompanyId',
  'customerEntityId',
  'orderingPersonId',
  'status',
  'notes',
] as const

export function tripDetailActionsForStatus(
  status: string,
  options?: { tripType?: string | null; canAuthorizeInternal?: boolean },
): TripDetailActionId[] {
  const normalized = normalizeTripStatus(status)
  let actions: TripDetailActionId[] = []
  if (
    options?.tripType === 'internal' &&
    normalized === 'pending_authorization' &&
    options.canAuthorizeInternal
  ) {
    actions = ['authorize_internal']
  } else {
    switch (normalized) {
      case 'new':
        actions = ['reject', 'approve']
        break
      case 'approved':
      case 'paid':
        actions = ['schedule']
        break
      case 'scheduled':
        actions = ['complete']
        break
      case 'pending_authorization':
        actions = options?.canAuthorizeInternal ? ['authorize_internal'] : []
        break
      default:
        actions = []
        break
    }
  }
  if (normalized !== 'new' && normalized !== 'completed' && normalized !== 'cancelled') {
    actions = ['cancel', ...actions]
  }
  return actions
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
    case 'pending_authorization':
      return 'none'
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

export function tripDetailAllowsDriverEdit(
  status: string,
  options?: TripDetailLockOptions,
): boolean {
  return isTripDetailFieldEditable(status, 'teamMemberId', options)
}

/**
 * Whether an update may change the driver. Unchanged `teamMemberId` is always allowed
 * (forms re-submit it). When status changes in the same request, locks are evaluated
 * against the target status so e.g. scheduled → new unlocks the driver.
 */
export function isTripDriverChangeAllowed(params: {
  currentStatus: string
  nextStatus?: string | null
  currentTeamMemberId: string | null
  nextTeamMemberId: string | null | undefined
  allowEditCompleted?: boolean
}): boolean {
  if (params.nextTeamMemberId === undefined) return true
  const currentId = params.currentTeamMemberId ?? null
  const nextId = params.nextTeamMemberId ?? null
  if (currentId === nextId) return true
  const statusForLock =
    params.nextStatus != null && String(params.nextStatus).trim()
      ? params.nextStatus
      : params.currentStatus
  return isTripDetailFieldEditable(statusForLock, 'teamMemberId', {
    allowEditCompleted: params.allowEditCompleted,
  })
}

export function isCompletedTripStatus(status: string): boolean {
  return normalizeTripStatus(status) === 'completed'
}

export function coerceTripStatusForPersistence(params: {
  tripType: string
  requestedStatus: string
}): string {
  return resolveDriverTripFinishStatus(params.tripType, normalizeTripStatus(params.requestedStatus))
}

/**
 * Narrow exception to the completed-trip lock: attach a receipt when the trip
 * has none yet. Used by the driver app “Add receipt” flow after completion.
 */
export function isCompletedTripReceiptSupplementUpdate(
  currentStatus: string,
  existingHasReceipt: boolean,
  update: Record<string, unknown>,
): boolean {
  const normalized = normalizeTripStatus(currentStatus)
  if (normalized !== 'completed') return false
  if (existingHasReceipt) return false

  const metadata = update.metadata
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return false
  const attachmentId = (metadata as Record<string, unknown>).receiptAttachmentId
  if (typeof attachmentId !== 'string' || !attachmentId.trim()) return false

  for (const key of RECEIPT_SUPPLEMENT_DISALLOWED_UPDATE_KEYS) {
    if (update[key] !== undefined) return false
  }
  return true
}
