export type SettlementTripExclusion = {
  tripId: string
  comment: string
  excludedAt: string
}

export const INCOME_DOCUMENT_DUPLICATE_EXCLUSION_COMMENT = 'document_duplicate'

export function parseSettlementTripExclusions(
  snapshotJson?: Record<string, unknown> | null,
): SettlementTripExclusion[] {
  const raw = snapshotJson?.excludedTrips
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is SettlementTripExclusion => {
      if (!item || typeof item !== 'object') return false
      const record = item as Partial<SettlementTripExclusion>
      return typeof record.tripId === 'string' && typeof record.comment === 'string'
    })
    .map((item) => ({
      tripId: item.tripId,
      comment: item.comment,
      excludedAt: typeof item.excludedAt === 'string' ? item.excludedAt : '',
    }))
}

export function settlementExcludedTripIds(exclusions: SettlementTripExclusion[]): Set<string> {
  return new Set(exclusions.map((item) => item.tripId))
}

export function findSettlementTripExclusion(
  exclusions: SettlementTripExclusion[],
  tripId: string,
): SettlementTripExclusion | undefined {
  return exclusions.find((item) => item.tripId === tripId)
}
