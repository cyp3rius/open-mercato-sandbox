export function computeCompanyNetProfitWithCompensationsMinusBonuses(params: {
  netAmount: number
  bonusAmount: number
  compensationAmount: number
}): number {
  // Logic requested by operator checklist:
  // - compensations increase company net profit
  // - bonuses decrease company net profit
  return params.netAmount + params.compensationAmount - params.bonusAmount
}

export function computeSettlementPreviewNetAmount(params: {
  netAmount: number
  bonusAmount: number
  compensationAmount: number
}): number {
  return params.netAmount - params.compensationAmount - params.bonusAmount
}

