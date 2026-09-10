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

export type SettlementCostEntrySnapshot = {
  id: string
  costType: string | null
  tripId: string | null
  amount: number
  vatRatePercent: number
  netAmount: number
  currencyCode: string
  documentNumber: string | null
  occurredAt: string | null
  notes: string | null
  receiptAttachmentId: string | null
}

export type SettlementCostsResult = {
  costsGross: number
  costsNet: number
  fuelCostGross: number
  fuelCostNet: number
  costBreakdown: SettlementCostBreakdown
  entries: SettlementCostEntrySnapshot[]
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
    weekStart?: string
    dateFrom?: string
    dateTo?: string
    excludedEntryIds?: ReadonlySet<string>
  },
): Promise<SettlementCostsResult> {
  const dateFrom = params.dateFrom ?? params.weekStart
  if (!dateFrom) {
    throw new Error('calculateSettlementCosts requires weekStart or dateFrom')
  }
  const dateTo = params.dateTo ?? (params.weekStart ? getWeekEnd(params.weekStart) : dateFrom)
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
        $gte: new Date(`${dateFrom}T00:00:00`),
        $lte: new Date(`${dateTo}T23:59:59`),
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
  const includedEntries: SettlementCostEntrySnapshot[] = []

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
    includedEntries.push({
      id: entry.id,
      costType: entry.costType ?? null,
      tripId: entry.tripId ?? null,
      amount: gross,
      vatRatePercent: vatRate,
      netAmount: net,
      currencyCode: entry.currencyCode || 'PLN',
      documentNumber: entry.documentNumber ?? null,
      occurredAt: entry.occurredAt ? entry.occurredAt.toISOString() : null,
      notes: entry.notes ?? null,
      receiptAttachmentId: entry.receiptAttachmentId ?? null,
    })
  }

  includedEntries.sort((left, right) => {
    const leftDate = left.occurredAt ?? ''
    const rightDate = right.occurredAt ?? ''
    return leftDate.localeCompare(rightDate)
  })

  return {
    costsGross,
    costsNet,
    fuelCostGross,
    fuelCostNet,
    costBreakdown,
    entries: includedEntries,
  }
}
