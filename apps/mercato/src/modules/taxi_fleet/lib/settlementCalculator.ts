import type { EntityManager } from '@mikro-orm/postgresql'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetFinancialEntry } from '../data/entities'
import { getWeekEnd } from './weekUtils'

export type SettlementTotals = {
  totalRevenue: number
  totalCosts: number
  netAmount: number
  payoutAmount: number
  tripIds: string[]
}

function toNumber(value: string | null | undefined): number {
  if (value == null) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export async function calculateWeeklySettlement(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    teamMemberId: string
    weekStart: string
    payoutPercent: number
  },
): Promise<SettlementTotals> {
  const weekEnd = getWeekEnd(params.weekStart)
  const entries = await findWithDecryption(
    em,
    TaxiFleetFinancialEntry,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      teamMemberId: params.teamMemberId,
      deletedAt: null,
      occurredAt: {
        $gte: new Date(`${params.weekStart}T00:00:00`),
        $lte: new Date(`${weekEnd}T23:59:59`),
      },
    },
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )

  let totalRevenue = 0
  let totalCosts = 0
  const tripIds = new Set<string>()
  for (const entry of entries) {
    const amount = toNumber(entry.amount)
    if (entry.kind === 'income') totalRevenue += amount
    if (entry.kind === 'expense') totalCosts += amount
    if (entry.tripId) tripIds.add(entry.tripId)
  }

  const netAmount = totalRevenue - totalCosts
  const payoutAmount = (netAmount * params.payoutPercent) / 100

  return {
    totalRevenue,
    totalCosts,
    netAmount,
    payoutAmount,
    tripIds: [...tripIds],
  }
}
