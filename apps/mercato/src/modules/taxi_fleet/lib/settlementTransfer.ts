export function computeTransferAmount(params: {
  payoutAmount: number
  cashExpected: number
  cashCollected: number
  airportA4Amount: number
}): number {
  return (
    params.payoutAmount -
    params.cashExpected +
    params.cashCollected +
    params.airportA4Amount
  )
}
