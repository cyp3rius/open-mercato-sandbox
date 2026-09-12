export type UberFleetCsvFilenameKind =
  | 'trip_activity'
  | 'payments_order'
  | 'payment_transactions'
  | 'payments'
  | string

export type UberFleetCsvFilenameRange = {
  from: string
  to: string
  kind: UberFleetCsvFilenameKind
}

const UBER_FLEET_FILENAME_RANGE_RE =
  /^(\d{8})-(\d{8})-(trip_activity|payments_order|payment_transactions|payments)(?:[-_.]|$)/i

/**
 * Parses Uber Fleet export filenames like:
 * `20260801-20260807-trip_activity-….csv` / `20260801-20260807-payments_order-….csv`.
 * Returns null when the pattern is missing (skip date-range check).
 */
export function parseUberFleetCsvFilenameRange(
  fileName: string | null | undefined,
): UberFleetCsvFilenameRange | null {
  if (!fileName || typeof fileName !== 'string') return null
  const base = fileName.trim().split(/[/\\]/).pop() ?? ''
  const withoutExt = base.replace(/\.csv$/i, '')
  const match = UBER_FLEET_FILENAME_RANGE_RE.exec(withoutExt)
  if (!match) return null
  return {
    from: match[1]!,
    to: match[2]!,
    kind: match[3]!.toLowerCase(),
  }
}

export function uberFleetCsvFilenameRangesMatch(
  leftName: string | null | undefined,
  rightName: string | null | undefined,
): { ok: true } | { ok: false; left: UberFleetCsvFilenameRange; right: UberFleetCsvFilenameRange } {
  const left = parseUberFleetCsvFilenameRange(leftName)
  const right = parseUberFleetCsvFilenameRange(rightName)
  if (!left || !right) return { ok: true }
  if (left.from === right.from && left.to === right.to) return { ok: true }
  return { ok: false, left, right }
}
