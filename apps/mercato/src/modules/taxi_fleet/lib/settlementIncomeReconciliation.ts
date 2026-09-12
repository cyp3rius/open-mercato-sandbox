import type { EntityManager } from '@mikro-orm/postgresql'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetFinancialEntry, TaxiFleetTrip } from '../data/entities'
import { getWeekEnd } from './weekUtils'
import { normalizeTripPlatform, type TaxiFleetTripPlatform } from './tripPlatforms'
import { readTripPaymentType, tripCountsForSettlementRevenue } from './settlementRevenue'
import type { TripRequestPaymentType } from './tripRequestForm'
import {
  isTripReceiptVerified,
  type DriverTripListExtras,
} from './driverTripReceiptStatus'
import type { SettlementTripSnapshot } from './settlementTripDistance'
import type { SettlementTripReceiptExtras } from './settlementTripReceiptEnrichment'
import { tripRequiresIncomeReceipt } from './tripIncomeReceiptRules'

export { tripRequiresIncomeReceipt } from './tripIncomeReceiptRules'

export type SettlementIncomeReconciliationSummary = {
  missingIncomeReceiptCount: number
  missingPlatformCount: number
  missingIncomeReceiptTripIds: string[]
  missingPlatformTripIds: string[]
}

function toNumber(value: string | null | undefined): number {
  if (value == null) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function tripMissingPlatformForRevenue(params: {
  platform: TaxiFleetTripPlatform | null
  revenueAmount: number
  status: string
}): boolean {
  if (!tripCountsForSettlementRevenue(params.status)) return false
  if (params.revenueAmount <= 0) return false
  return params.platform == null
}

function tripHasIncomeReceiptEvidence(params: {
  tripId: string
  incomeTripIds: ReadonlySet<string>
  receiptExtras?: SettlementTripReceiptExtras | DriverTripListExtras | null
}): boolean {
  if (params.incomeTripIds.has(params.tripId)) return true
  if (!params.receiptExtras) return false
  return isTripReceiptVerified(params.receiptExtras)
}

export function tripMissingIncomeReceipt(params: {
  tripId: string
  platform: TaxiFleetTripPlatform | null
  revenueAmount: number
  status: string
  incomeTripIds: ReadonlySet<string>
  receiptExtras?: SettlementTripReceiptExtras | DriverTripListExtras | null
}): boolean {
  if (!tripCountsForSettlementRevenue(params.status)) return false
  if (params.revenueAmount <= 0) return false
  if (!tripRequiresIncomeReceipt({ platform: params.platform })) return false
  return !tripHasIncomeReceiptEvidence(params)
}

export function buildSettlementIncomeReconciliationSummary(
  trips: SettlementTripSnapshot[],
): SettlementIncomeReconciliationSummary {
  const missingIncomeReceiptTripIds = trips
    .filter((trip) => trip.missingIncomeReceipt)
    .map((trip) => trip.id)
  const missingPlatformTripIds = trips.filter((trip) => trip.missingPlatform).map((trip) => trip.id)
  return {
    missingIncomeReceiptCount: missingIncomeReceiptTripIds.length,
    missingPlatformCount: missingPlatformTripIds.length,
    missingIncomeReceiptTripIds,
    missingPlatformTripIds,
  }
}

export function enrichSettlementTripSnapshot(params: {
  trip: {
    id: string
    startedAt?: Date | null
    endedAt?: Date | null
    status: string
    tripType: string
    platform?: string | null
    distanceKm?: string | null
    revenueAmount?: string | null
    metadata?: Record<string, unknown> | null
  }
  distanceKm: number | null
  missingDistance: boolean
  incomeTripIds: ReadonlySet<string>
  receiptExtras?: SettlementTripReceiptExtras | null
}): SettlementTripSnapshot {
  const platform = normalizeTripPlatform(params.trip.platform)
  const revenueAmount = toNumber(params.trip.revenueAmount)
  const paymentType = readTripPaymentType(params.trip.metadata ?? null)
  return {
    id: params.trip.id,
    startedAt: params.trip.startedAt ? params.trip.startedAt.toISOString() : null,
    endedAt: params.trip.endedAt ? params.trip.endedAt.toISOString() : null,
    status: params.trip.status,
    tripType: params.trip.tripType,
    platform: params.trip.platform ?? null,
    paymentType,
    revenueAmount: revenueAmount > 0 ? revenueAmount : null,
    distanceKm: params.distanceKm,
    missingDistance: params.missingDistance,
    missingPlatform: tripMissingPlatformForRevenue({
      platform,
      revenueAmount,
      status: params.trip.status,
    }),
    missingIncomeReceipt: tripMissingIncomeReceipt({
      tripId: params.trip.id,
      platform,
      revenueAmount,
      status: params.trip.status,
      incomeTripIds: params.incomeTripIds,
      receiptExtras: params.receiptExtras,
    }),
  }
}

export async function loadIncomeTripIdsForWeek(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    teamMemberId: string
    weekStart: string
  },
): Promise<Set<string>> {
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
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )
  const tripIds = trips.map((trip) => trip.id)
  if (!tripIds.length) return new Set<string>()

  const entries = await findWithDecryption(
    em,
    TaxiFleetFinancialEntry,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      teamMemberId: params.teamMemberId,
      kind: 'income',
      deletedAt: null,
      tripId: { $in: tripIds },
    },
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )
  const linkedTripIds = new Set<string>()
  for (const entry of entries) {
    if (entry.tripId) linkedTripIds.add(entry.tripId)
  }
  return linkedTripIds
}

export function readTripPaymentTypeFromSnapshot(trip: SettlementTripSnapshot): TripRequestPaymentType {
  return trip.paymentType ?? 'cash'
}
