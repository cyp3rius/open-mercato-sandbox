export type SettlementCostExclusion = {
  financialEntryId: string
  comment: string
  excludedAt: string
}

export function parseSettlementCostExclusions(
  snapshotJson?: Record<string, unknown> | null,
): SettlementCostExclusion[] {
  const raw = snapshotJson?.excludedCosts
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is SettlementCostExclusion => {
      if (!item || typeof item !== 'object') return false
      const record = item as Partial<SettlementCostExclusion>
      return typeof record.financialEntryId === 'string' && typeof record.comment === 'string'
    })
    .map((item) => ({
      financialEntryId: item.financialEntryId,
      comment: item.comment,
      excludedAt: typeof item.excludedAt === 'string' ? item.excludedAt : '',
    }))
}

export function settlementExcludedEntryIds(exclusions: SettlementCostExclusion[]): Set<string> {
  return new Set(exclusions.map((item) => item.financialEntryId))
}

export function findSettlementCostExclusion(
  exclusions: SettlementCostExclusion[],
  financialEntryId: string,
): SettlementCostExclusion | undefined {
  return exclusions.find((item) => item.financialEntryId === financialEntryId)
}
