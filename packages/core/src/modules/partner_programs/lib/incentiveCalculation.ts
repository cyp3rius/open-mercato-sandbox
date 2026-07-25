export type ProgramCandidateForIncentive = {
  programId: string
  incentivePercent: number
  incentiveBase: 'net' | 'gross'
  isActive: boolean
  validFrom: Date | null
  validTo: Date | null
}

export function parseIncentivePercent(value: string | number | null | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

export function isProgramValidOnDate(program: ProgramCandidateForIncentive, on: Date): boolean {
  if (!program.isActive) return false
  if (program.validFrom && program.validFrom.getTime() > on.getTime()) return false
  if (program.validTo && program.validTo.getTime() < on.getTime()) return false
  return true
}

/** Among valid programs, pick the one with the highest incentive percent. */
export function selectBestIncentiveProgram(
  candidates: ProgramCandidateForIncentive[],
  on: Date,
): ProgramCandidateForIncentive | null {
  let best: ProgramCandidateForIncentive | null = null
  for (const candidate of candidates) {
    if (!isProgramValidOnDate(candidate, on)) continue
    if (candidate.incentivePercent <= 0) continue
    if (!best || candidate.incentivePercent > best.incentivePercent) {
      best = candidate
    }
  }
  return best
}

/** Prefer explicit program selection; otherwise highest valid percent. */
export function resolveIncentiveProgram(
  candidates: ProgramCandidateForIncentive[],
  on: Date,
  selectedProgramId?: string | null,
): ProgramCandidateForIncentive | null {
  const selected =
    typeof selectedProgramId === 'string' && selectedProgramId.trim().length
      ? selectedProgramId.trim()
      : null
  if (selected) {
    const match = candidates.find((candidate) => candidate.programId === selected)
    if (!match) return null
    if (!isProgramValidOnDate(match, on)) return null
    if (match.incentivePercent <= 0) return null
    return match
  }
  return selectBestIncentiveProgram(candidates, on)
}

export function resolveOrderIncentiveBaseAmount(
  order: { grandTotalNetAmount?: string | null; grandTotalGrossAmount?: string | null },
  incentiveBase: 'net' | 'gross' | string | null | undefined,
): number {
  const useGross = incentiveBase === 'gross'
  const raw = useGross ? order.grandTotalGrossAmount : order.grandTotalNetAmount
  const amount = Number(raw ?? '0')
  return Number.isFinite(amount) ? amount : 0
}

export function calculateIncentiveAmount(baseAmount: number, percent: number): number {
  if (!Number.isFinite(baseAmount) || !Number.isFinite(percent)) return 0
  if (baseAmount <= 0 || percent <= 0) return 0
  return Math.round(baseAmount * percent * 100) / 10000
}

export function formatMoneyAmount(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return value.toFixed(4).replace(/\.?0+$/, (m) => (m.includes('.') ? m.replace(/0+$/, '').replace(/\.$/, '') : m)) || '0'
}

/** Normalize to 4 decimal places string for storage. */
export function toStoredAmount(value: number): string {
  if (!Number.isFinite(value)) return '0.0000'
  return value.toFixed(4)
}

export type LedgerBalanceRow = {
  currencyCode: string
  totalEarned: number
  payable: number
}

export function summarizeLedgerBalances(
  entries: Array<{ kind: string; amount: string | number; currencyCode: string }>,
): LedgerBalanceRow[] {
  const byCurrency = new Map<string, { earned: number; payable: number }>()
  for (const entry of entries) {
    const code = entry.currencyCode.trim().toUpperCase()
    if (!code) continue
    const amount =
      typeof entry.amount === 'number' ? entry.amount : Number(String(entry.amount).trim() || '0')
    if (!Number.isFinite(amount)) continue
    const bucket = byCurrency.get(code) ?? { earned: 0, payable: 0 }
    if (entry.kind === 'accrual' && amount > 0) {
      bucket.earned += amount
    }
    bucket.payable += amount
    byCurrency.set(code, bucket)
  }
  return [...byCurrency.entries()]
    .map(([currencyCode, row]) => ({
      currencyCode,
      totalEarned: Math.round(row.earned * 10000) / 10000,
      payable: Math.round(row.payable * 10000) / 10000,
    }))
    .sort((a, b) => a.currencyCode.localeCompare(b.currencyCode))
}
