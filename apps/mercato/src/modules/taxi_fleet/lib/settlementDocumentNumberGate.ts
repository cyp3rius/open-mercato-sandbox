import type { EntityManager } from '@mikro-orm/postgresql'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetFinancialEntry, TaxiFleetTrip } from '../data/entities'
import { getWeekEnd } from './weekUtils'
import { tripRequiresIncomeReceipt } from './tripIncomeReceiptRules'
import { settlementMissingDocumentNumberTripIds } from './receiptExtractionRules'
import { normalizeTripPlatform } from './tripPlatforms'
import { tripCountsForSettlementRevenue } from './settlementRevenue'

export async function assertWeeklySettlementDocumentNumbersComplete(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    teamMemberId: string
    weekStart: string
  },
): Promise<{ ok: true } | { ok: false; missingTripIds: string[] }> {
  const weekEnd = getWeekEnd(params.weekStart)
  const trips = await findWithDecryption(
    em,
    TaxiFleetTrip,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      teamMemberId: params.teamMemberId,
      deletedAt: null,
      startedAt: {
        $gte: new Date(`${params.weekStart}T00:00:00`),
        $lte: new Date(`${weekEnd}T23:59:59.999`),
      },
    },
    {},
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )

  const requiredTripIds = trips
    .filter((trip) => {
      const revenueAmount = Number(trip.revenueAmount ?? 0)
      if (!(revenueAmount > 0)) return false
      if (!tripCountsForSettlementRevenue(trip.status)) return false
      return tripRequiresIncomeReceipt({ platform: normalizeTripPlatform(trip.platform) })
    })
    .map((trip) => trip.id)

  if (!requiredTripIds.length) return { ok: true }

  const incomeEntries = await findWithDecryption(
    em,
    TaxiFleetFinancialEntry,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      teamMemberId: params.teamMemberId,
      kind: 'income',
      deletedAt: null,
      tripId: { $in: requiredTripIds },
    },
    {},
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )

  const missing = settlementMissingDocumentNumberTripIds({
    requiredTripIds,
    incomeEntries: incomeEntries.map((entry) => ({
      tripId: entry.tripId,
      documentNumber: entry.documentNumber,
    })),
  })

  if (missing.length) return { ok: false, missingTripIds: missing }
  return { ok: true }
}
