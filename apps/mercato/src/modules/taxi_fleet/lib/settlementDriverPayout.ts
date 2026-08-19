export function computeDriverPayoutBaseAmount(netAmount: number, payoutPercent: number): number {
  const net = Number.isFinite(netAmount) ? netAmount : 0
  const percent = Number.isFinite(payoutPercent) ? payoutPercent : 0
  return (net * percent) / 100
}

export function computeDriverPayoutAmount(params: {
  netAmount: number
  payoutPercent: number
  bonusAmount?: number
  compensationAmount?: number
}): number {
  const bonus = Math.max(0, Number(params.bonusAmount ?? 0))
  const compensation = Math.max(0, Number(params.compensationAmount ?? 0))
  return computeDriverPayoutBaseAmount(params.netAmount, params.payoutPercent) + bonus + compensation
}
