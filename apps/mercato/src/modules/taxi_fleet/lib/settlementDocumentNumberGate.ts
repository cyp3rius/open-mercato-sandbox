import type { EntityManager } from '@mikro-orm/postgresql'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetFinancialEntry, TaxiFleetTrip } from '../data/entities'
import { getWeekEnd } from './weekUtils'
import { tripRequiresIncomeReceipt } from './tripIncomeReceiptRules'
import { settlementMissingDocumentNumberTripIds } from './receiptExtractionRules'
import { normalizeTripPlatform } from './tripPlatforms'
import { tripCountsForSettlementRevenue } from './settlementRevenue'

function readTripReceiptDocumentNumber(trip: TaxiFleetTrip): string | null {
  const metadata = trip.metadata
  if (!metadata || typeof metadata !== 'object') return null
  const value = metadata.receiptDocumentNumber
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

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

  const requiredTrips = trips.filter((trip) => {
    const revenueAmount = Number(trip.revenueAmount ?? 0)
    if (!(revenueAmount > 0)) return false
    if (!tripCountsForSettlementRevenue(trip.status)) return false
    return tripRequiresIncomeReceipt({ platform: normalizeTripPlatform(trip.platform) })
  })
  const requiredTripIds = requiredTrips.map((trip) => trip.id)

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

  const documentNumberByTripId = new Map<string, string>()
  for (const entry of incomeEntries) {
    if (!entry.tripId) continue
    const fromEntry = entry.documentNumber?.trim()
    if (fromEntry) documentNumberByTripId.set(entry.tripId, fromEntry)
  }
  for (const trip of requiredTrips) {
    if (documentNumberByTripId.has(trip.id)) continue
    const fromMetadata = readTripReceiptDocumentNumber(trip)
    if (fromMetadata) documentNumberByTripId.set(trip.id, fromMetadata)
  }

  const missing = settlementMissingDocumentNumberTripIds({
    requiredTripIds,
    incomeEntries: requiredTripIds.map((tripId) => ({
      tripId,
      documentNumber: documentNumberByTripId.get(tripId) ?? null,
    })),
  })

  if (missing.length) return { ok: false, missingTripIds: missing }
  return { ok: true }
}
