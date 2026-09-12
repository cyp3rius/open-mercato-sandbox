import { computeTransferAmount } from './settlementTransfer'

export type SettlementCashHandover = {
  cashTransferred: number
  cashNotTransferred: number
}

export type SettlementPayoutDisplay = {
  cashPayout: number
  transferPayout: number | null
  driverReturnDue: number | null
}

export function computeSettlementCashHandover(params: {
  cashExpected: number
  cashCollected: number
}): SettlementCashHandover {
  const expected = Math.max(0, params.cashExpected)
  const collected = Math.max(0, params.cashCollected)
  const cashTransferred = Math.min(collected, expected)
  const cashNotTransferred = Math.max(0, expected - collected)
  return { cashTransferred, cashNotTransferred }
}

export function computeSettlementPayoutDisplay(params: {
  payoutAmount: number
  cashExpected: number
  cashCollected: number
  airportA4Amount?: number
}): SettlementPayoutDisplay {
  const payout = Math.max(0, params.payoutAmount)
  const collected = Math.max(0, params.cashCollected)
  const { cashNotTransferred } = computeSettlementCashHandover({
    cashExpected: params.cashExpected,
    cashCollected: params.cashCollected,
  })

  if (cashNotTransferred > 0.005) {
    const cashPayout = Math.min(cashNotTransferred, payout)
    const driverReturnDue = Math.max(0, cashNotTransferred - payout)
    const transferPayout = Math.max(0, payout - cashNotTransferred)
    return {
      cashPayout: cashPayout > 0.005 ? cashPayout : 0,
      transferPayout: transferPayout > 0.005 ? transferPayout : null,
      driverReturnDue: driverReturnDue > 0.005 ? driverReturnDue : null,
    }
  }

  const transferPayout = Math.max(
    0,
    computeTransferAmount({
      payoutAmount: payout,
      cashExpected: params.cashExpected,
      cashCollected: collected,
      airportA4Amount: params.airportA4Amount ?? 0,
    }),
  )
  return {
    cashPayout: 0,
    transferPayout: transferPayout > 0.005 ? transferPayout : null,
    driverReturnDue: null,
  }
}

export function resolveSettlementListPayouts(row: {
  payoutAmount?: string | number | null
  cashExpected?: string | number | null
  cashCollected?: string | number | null
  airportA4Amount?: string | number | null
}): SettlementPayoutDisplay {
  return computeSettlementPayoutDisplay({
    payoutAmount: Number(row.payoutAmount ?? 0),
    cashExpected: Number(row.cashExpected ?? 0),
    cashCollected: Number(row.cashCollected ?? 0),
    airportA4Amount: Number(row.airportA4Amount ?? 0),
  })
}

export function formatSettlementMoney(value: number | string | null | undefined): string {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '—'
  return `${parsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN`
}
