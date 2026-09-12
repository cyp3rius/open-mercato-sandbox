export function computeCashVariance(cashCollected: number, cashExpected: number): number {
  const collected = Number.isFinite(cashCollected) ? cashCollected : 0
  const expected = Number.isFinite(cashExpected) ? cashExpected : 0
  return collected - expected
}
