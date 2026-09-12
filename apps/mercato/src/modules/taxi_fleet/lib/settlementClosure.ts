import type { SettlementPayoutDisplay } from './settlementPayoutDisplay'

export const SETTLEMENT_CLOSURE_TYPES = ['payout', 'cash_return'] as const

export type SettlementClosureType = (typeof SETTLEMENT_CLOSURE_TYPES)[number]

export type SettlementClosureRecord = {
  type: SettlementClosureType
  amount: number
}

export function computeSettlementPayoutDue(payoutDisplay: SettlementPayoutDisplay): number {
  return payoutDisplay.cashPayout + (payoutDisplay.transferPayout ?? 0)
}

export function computeSettlementReturnDue(payoutDisplay: SettlementPayoutDisplay): number {
  return payoutDisplay.driverReturnDue ?? 0
}

export function computeSettlementClosurePayoutDue(payoutDisplay: SettlementPayoutDisplay): number {
  if (computeSettlementReturnDue(payoutDisplay) > 0.005) return 0
  return computeSettlementPayoutDue(payoutDisplay)
}

export function suggestSettlementClosureType(payoutDisplay: SettlementPayoutDisplay): SettlementClosureType {
  if (computeSettlementReturnDue(payoutDisplay) > 0.005) return 'cash_return'
  return 'payout'
}

export function suggestSettlementClosureAmount(
  closureType: SettlementClosureType,
  payoutDisplay: SettlementPayoutDisplay,
): number {
  if (closureType === 'cash_return') {
    return computeSettlementReturnDue(payoutDisplay)
  }
  return computeSettlementClosurePayoutDue(payoutDisplay)
}

export function isSettlementClosureTypeAvailable(
  closureType: SettlementClosureType,
  payoutDisplay: SettlementPayoutDisplay,
): boolean {
  if (closureType === 'payout') return computeSettlementClosurePayoutDue(payoutDisplay) > 0.005
  return computeSettlementReturnDue(payoutDisplay) > 0.005
}

export function computeSettlementFinalBalance(params: {
  payoutDisplay: SettlementPayoutDisplay
  closure: SettlementClosureRecord | null
}): {
  payoutDue: number
  returnDue: number
  remainingPayout: number
  remainingReturn: number
  finalBalance: number
  isBalanced: boolean
} {
  const payoutDue = computeSettlementClosurePayoutDue(params.payoutDisplay)
  const returnDue = computeSettlementReturnDue(params.payoutDisplay)

  let recordedPayout = 0
  let recordedReturn = 0
  if (params.closure) {
    if (params.closure.type === 'payout') {
      recordedPayout = Math.max(0, params.closure.amount)
    } else {
      recordedReturn = Math.max(0, params.closure.amount)
    }
  }

  const remainingPayout = Math.max(0, payoutDue - recordedPayout)
  const remainingReturn = Math.max(0, returnDue - recordedReturn)
  const finalBalance = remainingPayout + remainingReturn

  return {
    payoutDue,
    returnDue,
    remainingPayout,
    remainingReturn,
    finalBalance,
    isBalanced: finalBalance <= 0.005,
  }
}

export function parseSettlementClosureRecord(
  row: {
    closureType?: string | null
    closureAmount?: string | number | null
  } | null | undefined,
): SettlementClosureRecord | null {
  if (!row?.closureType) return null
  if (row.closureType !== 'payout' && row.closureType !== 'cash_return') return null
  const amount = Number(row.closureAmount ?? 0)
  if (!Number.isFinite(amount)) return null
  return { type: row.closureType, amount }
}
