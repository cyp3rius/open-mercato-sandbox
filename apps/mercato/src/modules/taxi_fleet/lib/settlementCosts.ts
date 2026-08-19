import type { EntityManager } from '@mikro-orm/postgresql'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetFinancialEntry } from '../data/entities'
import { TAXI_FLEET_COST_TYPES, type TaxiFleetCostType } from './costTypes'
import { expenseGrossToNet, normalizeExpenseVatRatePercent } from './expenseVat'
import { getWeekEnd } from './weekUtils'

export type SettlementCostLine = {
  gross: number
  net: number
}

export type SettlementCostBreakdown = Record<TaxiFleetCostType | 'unknown', SettlementCostLine>

export type SettlementCostsResult = {
  costsGross: number
  costsNet: number
  fuelCostGross: number
  fuelCostNet: number
  costBreakdown: SettlementCostBreakdown
}

export function emptySettlementCostBreakdown(): SettlementCostBreakdown {
  const breakdown = {} as SettlementCostBreakdown
  for (const costType of TAXI_FLEET_COST_TYPES) {
    breakdown[costType] = { gross: 0, net: 0 }
  }
  breakdown.unknown = { gross: 0, net: 0 }
  return breakdown
}

function toNumber(value: string | null | undefined): number {
  if (value == null) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function calculateSettlementCosts(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    teamMemberId: string
    weekStart: string
    excludedEntryIds?: ReadonlySet<string>
  },
): Promise<SettlementCostsResult> {
  const weekEnd = getWeekEnd(params.weekStart)
  const entries = await findWithDecryption(
    em,
    TaxiFleetFinancialEntry,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      teamMemberId: params.teamMemberId,
      kind: 'expense',
      deletedAt: null,
      occurredAt: {
        $gte: new Date(`${params.weekStart}T00:00:00`),
        $lte: new Date(`${weekEnd}T23:59:59`),
      },
    },
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )

  let costsGross = 0
  let costsNet = 0
  let fuelCostGross = 0
  let fuelCostNet = 0
  const costBreakdown = emptySettlementCostBreakdown()

  for (const entry of entries) {
    if (params.excludedEntryIds?.has(entry.id)) continue
    const gross = toNumber(entry.amount)
    const vatRate = normalizeExpenseVatRatePercent(entry.vatRatePercent)
    const net = expenseGrossToNet(gross, vatRate)
    costsGross += gross
    costsNet += net
    const bucket =
      entry.costType && TAXI_FLEET_COST_TYPES.includes(entry.costType as TaxiFleetCostType)
        ? (entry.costType as TaxiFleetCostType)
        : 'unknown'
    costBreakdown[bucket].gross += gross
    costBreakdown[bucket].net += net
    if (entry.costType === 'fuel') {
      fuelCostGross += gross
      fuelCostNet += net
    }
  }

  return { costsGross, costsNet, fuelCostGross, fuelCostNet, costBreakdown }
}
