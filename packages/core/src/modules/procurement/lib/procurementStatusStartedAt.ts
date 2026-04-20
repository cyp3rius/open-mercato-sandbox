import { normalizeDictionaryValue } from '@open-mercato/core/modules/dictionaries/lib/utils'

/**
 * Status values treated as "not started" (e.g. New / Draft). `startedAt` stays null until leaving this set.
 * Uses normalized dictionary values (trim + lowercase).
 */
const NOT_STARTED_STATUS_VALUES = new Set(['draft', 'new'])

function normalizedStatus(value: string | null | undefined): string | null {
  if (value == null) return null
  const n = normalizeDictionaryValue(String(value))
  return n.length ? n : null
}

function isClosedStatus(normalized: string): boolean {
  return normalized === 'closed'
}

/** After create: set startedAt when the process is created directly in a "started" status (not New/Draft, not Closed). */
export function shouldAutoSetStartedAtOnCreate(statusValue: string | null | undefined): boolean {
  const n = normalizedStatus(statusValue)
  if (!n || isClosedStatus(n)) return false
  return !NOT_STARTED_STATUS_VALUES.has(n)
}

/**
 * On update: set startedAt when moving from New/Draft to any other non-closed status
 * (e.g. Draft → Active / In Progress).
 */
export function shouldAutoSetStartedAtOnStatusChange(
  previousStatus: string | null | undefined,
  nextStatus: string | null | undefined,
): boolean {
  const from = normalizedStatus(previousStatus)
  const to = normalizedStatus(nextStatus)
  if (!to || isClosedStatus(to)) return false
  if (!from || !NOT_STARTED_STATUS_VALUES.has(from)) return false
  return !NOT_STARTED_STATUS_VALUES.has(to)
}
