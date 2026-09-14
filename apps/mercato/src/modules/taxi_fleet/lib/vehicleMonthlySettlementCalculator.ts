import type { EntityManager } from '@mikro-orm/postgresql'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetDailyAssignment, TaxiFleetLocationPing, TaxiFleetTrip } from '../data/entities'
import { aggregateGpsDistanceKm } from './assignmentGpsDistance'
import {
  buildSettlementRevenueFromTrips,
  readTripPaymentType,
  tripCountsForSettlementRevenue,
} from './settlementRevenue'
import { computeEmptyDistanceKm, resolveSettlementTotalDistanceKm } from './settlementGpsDistance'
import { parseTripDistanceKm, resolveTripWeekDate } from './settlementTripDistance'
import { revenueGrossToNet } from './settlementVat'
import {
  TRIP_REQUEST_PAYMENT_TYPES,
  type TripRequestPaymentType,
} from './tripRequestForm'
import { getMonthEnd, normalizeDateOnly } from './weekUtils'
import { computeCashVariance as computeCashVarianceBase } from './settlementCashVariance'

export type VehicleMonthlyPaymentBreakdown = Record<TripRequestPaymentType, number>

export type VehicleMonthlyCashTripSnapshot = {
  id: string
  startedAt: string | null
  teamMemberId: string | null
  revenueAmount: number
  paymentType: TripRequestPaymentType
}

export type VehicleMonthlySettlementTotals = {
  shiftGpsKm: number
  tripKm: number
  emptyKm: number
  revenueGross: number
  revenueNet: number
  cashExpected: number
  bpFuelCost: number
  paymentByType: VehicleMonthlyPaymentBreakdown
  cashTrips: VehicleMonthlyCashTripSnapshot[]
  assignmentIds: string[]
  tripIds: string[]
  snapshot: {
    monthStart: string
    monthEnd: string
    resourceId: string
    paymentByType: VehicleMonthlyPaymentBreakdown
    cashTrips: VehicleMonthlyCashTripSnapshot[]
    assignmentIds: string[]
    tripIds: string[]
  }
}

function emptyPaymentBreakdown(): VehicleMonthlyPaymentBreakdown {
  const out = {} as VehicleMonthlyPaymentBreakdown
  for (const key of TRIP_REQUEST_PAYMENT_TYPES) out[key] = 0
  return out
}

function toNumber(value: string | null | undefined): number {
  if (value == null) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseStoredGpsKm(value: string | null | undefined): number | null {
  if (value == null || String(value).trim() === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

function tripInMonth(
  trip: { startedAt?: Date | null; endedAt?: Date | null },
  monthStart: string,
  monthEnd: string,
): boolean {
  const day = resolveTripWeekDate(trip)
  if (!day) return false
  return day >= monthStart && day <= monthEnd
}

async function sumPingsForAssignment(
  em: EntityManager,
  assignmentId: string,
  scope: { tenantId: string; organizationId: string },
): Promise<number> {
  const pings = await findWithDecryption(
    em,
    TaxiFleetLocationPing,
    {
      assignmentId,
      tenantId: scope.tenantId,
      organizationId: scope.organizationId,
    },
    { orderBy: { recordedAt: 'ASC' } },
    scope,
  )
  return aggregateGpsDistanceKm(
    pings.map((ping) => ({
      lat: Number(ping.lat),
      lon: Number(ping.lon),
      recordedAt: ping.recordedAt,
      accuracyM: ping.accuracyM != null ? Number(ping.accuracyM) : null,
    })),
  )
}

export async function calculateVehicleShiftGpsKm(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    resourceId: string
    monthStart: string
  },
): Promise<{ shiftGpsKm: number; assignmentIds: string[] }> {
  const monthEnd = getMonthEnd(params.monthStart)
  const assignments = await findWithDecryption(
    em,
    TaxiFleetDailyAssignment,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      resourceId: params.resourceId,
      deletedAt: null,
      status: { $ne: 'cancelled' },
      assignmentDate: {
        $gte: params.monthStart,
        $lte: monthEnd,
      },
    },
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )

  let total = 0
  const assignmentIds: string[] = []
  for (const assignment of assignments) {
    const day = normalizeDateOnly(assignment.assignmentDate)
    if (!day || day < params.monthStart || day > monthEnd) continue
    assignmentIds.push(assignment.id)
    const stored = parseStoredGpsKm(assignment.gpsDistanceKm)
    if (stored != null) {
      total += stored
      continue
    }
    if (!assignment.shiftStart) continue
    total += await sumPingsForAssignment(em, assignment.id, {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
    })
  }
  return { shiftGpsKm: Math.round(total * 100) / 100, assignmentIds }
}

export async function loadVehicleTripsInMonth(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    resourceId: string
    monthStart: string
  },
): Promise<TaxiFleetTrip[]> {
  const monthEnd = getMonthEnd(params.monthStart)
  const rows = await findWithDecryption(
    em,
    TaxiFleetTrip,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      resourceId: params.resourceId,
      deletedAt: null,
      $or: [
        {
          startedAt: {
            $gte: new Date(`${params.monthStart}T00:00:00`),
            $lte: new Date(`${monthEnd}T23:59:59`),
          },
        },
        {
          startedAt: null,
          endedAt: {
            $gte: new Date(`${params.monthStart}T00:00:00`),
            $lte: new Date(`${monthEnd}T23:59:59`),
          },
        },
      ],
    },
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )
  return rows.filter((trip) => tripInMonth(trip, params.monthStart, monthEnd))
}

export async function listVehicleResourceIdsForMonth(
  em: EntityManager,
  params: { tenantId: string; organizationId: string; monthStart: string },
): Promise<string[]> {
  const monthEnd = getMonthEnd(params.monthStart)
  const scope = { tenantId: params.tenantId, organizationId: params.organizationId }
  const [assignments, trips] = await Promise.all([
    findWithDecryption(
      em,
      TaxiFleetDailyAssignment,
      {
        ...scope,
        deletedAt: null,
        status: { $ne: 'cancelled' },
        assignmentDate: { $gte: params.monthStart, $lte: monthEnd },
      },
      undefined,
      scope,
    ),
    findWithDecryption(
      em,
      TaxiFleetTrip,
      {
        ...scope,
        deletedAt: null,
        resourceId: { $ne: null },
        $or: [
          {
            startedAt: {
              $gte: new Date(`${params.monthStart}T00:00:00`),
              $lte: new Date(`${monthEnd}T23:59:59`),
            },
          },
          {
            startedAt: null,
            endedAt: {
              $gte: new Date(`${params.monthStart}T00:00:00`),
              $lte: new Date(`${monthEnd}T23:59:59`),
            },
          },
        ],
      },
      undefined,
      scope,
    ),
  ])

  const ids = new Set<string>()
  for (const row of assignments) {
    if (row.resourceId) ids.add(row.resourceId)
  }
  for (const trip of trips) {
    if (!trip.resourceId) continue
    if (!tripInMonth(trip, params.monthStart, monthEnd)) continue
    ids.add(trip.resourceId)
  }
  return [...ids]
}

export function computeCashVariance(cashReported: number, cashExpected: number): number {
  return Math.round(computeCashVarianceBase(cashReported, cashExpected) * 100) / 100
}

export async function calculateVehicleMonthlySettlement(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    resourceId: string
    monthStart: string
  },
): Promise<VehicleMonthlySettlementTotals> {
  const monthEnd = getMonthEnd(params.monthStart)
  const [{ shiftGpsKm, assignmentIds }, trips] = await Promise.all([
    calculateVehicleShiftGpsKm(em, params),
    loadVehicleTripsInMonth(em, params),
  ])

  const revenue = buildSettlementRevenueFromTrips(trips)
  const paymentByType = emptyPaymentBreakdown()
  const cashTrips: VehicleMonthlyCashTripSnapshot[] = []
  let tripKm = 0

  for (const trip of trips) {
    if (!tripCountsForSettlementRevenue(trip.status)) continue
    const amount = toNumber(trip.revenueAmount)
    const paymentType = readTripPaymentType(trip.metadata ?? null)
    if (amount > 0) paymentByType[paymentType] += amount
    const distance = parseTripDistanceKm(trip.distanceKm)
    if (distance != null) tripKm += distance
    if (paymentType === 'cash' && amount > 0) {
      cashTrips.push({
        id: trip.id,
        startedAt: trip.startedAt?.toISOString() ?? trip.endedAt?.toISOString() ?? null,
        teamMemberId: trip.teamMemberId ?? null,
        revenueAmount: amount,
        paymentType,
      })
    }
  }
  tripKm = Math.round(tripKm * 100) / 100
  const totalDistanceKm = resolveSettlementTotalDistanceKm(shiftGpsKm, tripKm)
  const emptyKm = computeEmptyDistanceKm(totalDistanceKm, tripKm)

  return {
    shiftGpsKm,
    tripKm,
    emptyKm,
    revenueGross: revenue.revenueGross,
    revenueNet: revenueGrossToNet(revenue.revenueGross),
    cashExpected: revenue.cashExpected,
    bpFuelCost: 0,
    paymentByType,
    cashTrips,
    assignmentIds,
    tripIds: revenue.tripIds,
    snapshot: {
      monthStart: params.monthStart,
      monthEnd,
      resourceId: params.resourceId,
      paymentByType,
      cashTrips,
      assignmentIds,
      tripIds: revenue.tripIds,
    },
  }
}
