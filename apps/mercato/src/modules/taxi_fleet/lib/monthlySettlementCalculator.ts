import type { EntityManager } from '@mikro-orm/postgresql'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetMonthlySettlement, TaxiFleetWeeklySettlement } from '../data/entities'
import { calculateSettlementCosts, type SettlementCostEntrySnapshot } from './settlementCosts'
import {
  resolveSettlementPayoutPercent,
  type DriverPayoutSchedule,
  type ResolvedSettlementPayout,
} from './settlementPayoutResolve'
import {
  buildSettlementRevenueFromTrips,
  classifySettlementRevenueLine,
  emptySettlementRevenueBreakdown,
  readTripPaymentType,
  tripCountsForSettlementRevenue,
  type SettlementRevenueBreakdown,
  type SettlementRevenueLineKey,
} from './settlementRevenue'
import { SETTLEMENT_REVENUE_LINE_KEYS } from './settlementRevenueBreakdown'
import { normalizeTripPlatform } from './tripPlatforms'
import { revenueGrossToNet } from './settlementVat'
import { computeTransferAmount } from './settlementTransfer'
import {
  buildSettlementDistanceFromTrips,
  loadDriverTripsInDateRange,
  resolveTripWeekDate,
} from './settlementTripDistance'
import {
  parseMonthlySettlementSegments,
  parseWeeklyTripSnapshot,
  type MonthlySettlementCostLine,
  type MonthlySettlementSegment,
  type MonthlySettlementSegmentStraddle,
  type MonthlySettlementTripLine,
} from './monthlySettlementSnapshot'
import {
  computeDriverPayoutBaseAmount,
} from './settlementDriverPayout'
import {
  addDays,
  getIsoWeekStart,
  getMonthEnd,
  getWeekEnd,
  isMonthFullyCompleted,
  normalizeDateOnly,
} from './weekUtils'

export type {
  MonthlySettlementCostLine,
  MonthlySettlementTripLine,
  MonthlySettlementSegment,
  MonthlyDriverBreakdownLine,
} from './monthlySettlementSnapshot'

export const PLATFORM_SETTLEMENT_REVENUE_LINE_KEYS = [
  'uber_platform',
  'bolt_platform',
  'uber_cash',
  'free',
] as const satisfies readonly SettlementRevenueLineKey[]

export type PlatformSettlementRevenueLineKey = (typeof PLATFORM_SETTLEMENT_REVENUE_LINE_KEYS)[number]

const PLATFORM_LINE_SET = new Set<string>(PLATFORM_SETTLEMENT_REVENUE_LINE_KEYS)

export function isPlatformSettlementRevenueLine(key: SettlementRevenueLineKey): boolean {
  return PLATFORM_LINE_SET.has(key)
}

export type WeeklySettlementLink = {
  id: string
  weekStart: string
}

export type MonthlySettlementSnapshot = {
  monthStart: string
  monthEnd: string
  teamMemberId: string
  weeklySettlementIds: string[]
  weeklyCount: number
  revenueBreakdown: SettlementRevenueBreakdown
  platformTripIds: string[]
  platformTripIdsSkippedAlreadySettled: string[]
  nonPlatformTripIds: string[]
  calendarCashTripIds: string[]
  segments: MonthlySettlementSegment[]
  trips: MonthlySettlementTripLine[]
  costs: MonthlySettlementCostLine[]
  payout?: {
    mode: 'segmented'
    segmentsCount: number
    /** Monthly payout is always bank transfer; cash handover stays on weeklies only. */
    transferOnly: true
  }
}

export type MonthlySettlementSegmentDef = {
  id: string
  kind: 'leading' | 'week'
  dateFrom: string
  dateTo: string
  weekStart: string | null
}

export type MonthlySettlementTotals = {
  revenueGross: number
  revenueNet: number
  costsGross: number
  costsNet: number
  netAmount: number
  /** Unused for segmented payout — kept 0 for entity column BC. */
  payoutPercent: number
  payoutAmount: number
  totalDistanceKm: number
  computedDistanceKm: number
  emptyDistanceKm: number
  /** Always 0 on monthly — cash control lives on weeklies only. */
  cashExpected: number
  /** Always 0 on monthly — cash control lives on weeklies only. */
  cashCollected: number
  /** Equals payout (+ airport A4); no cash offset on monthly. */
  transferAmount: number
  weeklyCount: number
  revenueBreakdown: SettlementRevenueBreakdown
  payoutResolution: ResolvedSettlementPayout
  snapshot: MonthlySettlementSnapshot
}

function toNumber(value: string | null | undefined): number {
  if (value == null) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Roll up weekly cash handover (control-only; not used for monthly payout split). */
export function aggregateMonthlyCashFromWeeklies(
  weeklies: Array<{
    cashExpected?: string | number | null
    cashCollected?: string | number | null
  }>,
): { cashExpected: number; cashCollected: number } {
  let cashExpected = 0
  let cashCollected = 0
  for (const weekly of weeklies) {
    cashExpected += toNumber(
      typeof weekly.cashExpected === 'number' ? String(weekly.cashExpected) : weekly.cashExpected,
    )
    cashCollected += toNumber(
      typeof weekly.cashCollected === 'number' ? String(weekly.cashCollected) : weekly.cashCollected,
    )
  }
  return { cashExpected, cashCollected }
}

export function isTrailingPartialWeekSegment(segment: {
  kind: string
  weekStart: string | null
  dateTo: string
}): boolean {
  if (segment.kind !== 'week' || !segment.weekStart) return false
  return segment.dateTo < getWeekEnd(segment.weekStart)
}

/** Trailing partial segments from prior months — payout already attributed per ISO weekStart. */
export function collectPriorStraddleAttributedPayouts(
  priorMonthlies: Array<{ snapshotJson?: Record<string, unknown> | null }>,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of priorMonthlies) {
    for (const segment of parseMonthlySettlementSegments(row.snapshotJson)) {
      if (!isTrailingPartialWeekSegment(segment) || !segment.weekStart) continue
      map.set(segment.weekStart, (map.get(segment.weekStart) ?? 0) + segment.payoutAmount)
    }
  }
  return map
}

export function computeLeadingRemainderPayout(params: {
  weeklyPayoutAmount: number
  priorAttributedPayout: number
}): number {
  return Math.max(0, params.weeklyPayoutAmount - Math.max(0, params.priorAttributedPayout))
}

export function parsePlatformTripIdsFromSnapshot(
  snapshotJson: Record<string, unknown> | null | undefined,
): string[] {
  const raw = snapshotJson?.platformTripIds
  if (!Array.isArray(raw)) return []
  return raw.filter((id): id is string => typeof id === 'string' && id.length > 0)
}

export function collectAlreadySettledPlatformTripIds(
  priorMonthlies: Array<{ snapshotJson?: Record<string, unknown> | null }>,
): Set<string> {
  const ids = new Set<string>()
  for (const row of priorMonthlies) {
    for (const id of parsePlatformTripIdsFromSnapshot(row.snapshotJson)) {
      ids.add(id)
    }
  }
  return ids
}

export function filterPlatformTripsForMonthly(
  trips: Array<{
    id: string
    status: string
    platform?: string | null
    revenueAmount?: string | null
    metadata?: Record<string, unknown> | null
  }>,
  alreadySettled: ReadonlySet<string>,
): {
  included: typeof trips
  platformTripIds: string[]
  skippedAlreadySettled: string[]
} {
  const included: typeof trips = []
  const platformTripIds: string[] = []
  const skippedAlreadySettled: string[] = []

  for (const trip of trips) {
    if (!tripCountsForSettlementRevenue(trip.status)) continue
    const amount = toNumber(trip.revenueAmount)
    if (amount <= 0) continue
    const platform = normalizeTripPlatform(trip.platform)
    const paymentType = readTripPaymentType(trip.metadata ?? null)
    const line = classifySettlementRevenueLine({ platform, paymentType })
    if (!isPlatformSettlementRevenueLine(line)) continue
    if (alreadySettled.has(trip.id)) {
      skippedAlreadySettled.push(trip.id)
      continue
    }
    included.push(trip)
    platformTripIds.push(trip.id)
  }

  return { included, platformTripIds, skippedAlreadySettled }
}

export function buildNonPlatformRevenueFromCalendarTrips(
  trips: Array<{
    id: string
    status: string
    platform?: string | null
    revenueAmount?: string | null
    metadata?: Record<string, unknown> | null
  }>,
): {
  breakdown: SettlementRevenueBreakdown
  revenueGross: number
  revenueNet: number
  nonPlatformTripIds: string[]
  cashExpected: number
  calendarCashTripIds: string[]
} {
  const breakdown = emptySettlementRevenueBreakdown()
  let revenueGross = 0
  let cashExpected = 0
  const nonPlatformTripIds: string[] = []
  const calendarCashTripIds: string[] = []

  for (const trip of trips) {
    if (!tripCountsForSettlementRevenue(trip.status)) continue
    const amount = toNumber(trip.revenueAmount)
    if (amount <= 0) continue
    const platform = normalizeTripPlatform(trip.platform)
    const paymentType = readTripPaymentType(trip.metadata ?? null)
    const line = classifySettlementRevenueLine({ platform, paymentType })

    if (paymentType === 'cash') {
      cashExpected += amount
      calendarCashTripIds.push(trip.id)
    }

    if (isPlatformSettlementRevenueLine(line)) continue

    breakdown[line] += amount
    revenueGross += amount
    nonPlatformTripIds.push(trip.id)
  }

  return {
    breakdown,
    revenueGross,
    revenueNet: revenueGrossToNet(revenueGross),
    nonPlatformTripIds,
    cashExpected,
    calendarCashTripIds,
  }
}

export function mergeRevenueBreakdowns(
  ...parts: SettlementRevenueBreakdown[]
): SettlementRevenueBreakdown {
  const merged = emptySettlementRevenueBreakdown()
  for (const part of parts) {
    for (const key of SETTLEMENT_REVENUE_LINE_KEYS) {
      merged[key] += part[key]
    }
  }
  return merged
}

/** ISO-week slices for a calendar month: optional leading days + each weekStart in month. */
export function buildMonthlySettlementSegmentDefs(monthStart: string): MonthlySettlementSegmentDef[] {
  const monthEnd = getMonthEnd(monthStart)
  const defs: MonthlySettlementSegmentDef[] = []

  let firstMondayInMonth = getIsoWeekStart(monthStart)
  if (firstMondayInMonth < monthStart) {
    firstMondayInMonth = addDays(firstMondayInMonth, 7)
  }

  if (firstMondayInMonth > monthStart) {
    const leadingTo = addDays(firstMondayInMonth, -1)
    defs.push({
      id: `${monthStart}_leading`,
      kind: 'leading',
      dateFrom: monthStart,
      dateTo: leadingTo > monthEnd ? monthEnd : leadingTo,
      weekStart: getIsoWeekStart(monthStart),
    })
  }

  let cursor = firstMondayInMonth
  while (cursor <= monthEnd) {
    const weekEnd = getWeekEnd(cursor)
    const dateFrom = cursor < monthStart ? monthStart : cursor
    const dateTo = weekEnd > monthEnd ? monthEnd : weekEnd
    defs.push({
      id: cursor,
      kind: 'week',
      dateFrom,
      dateTo,
      weekStart: cursor,
    })
    cursor = addDays(cursor, 7)
  }

  return defs
}

function tripDateInRange(
  trip: { startedAt?: Date | null; endedAt?: Date | null },
  dateFrom: string,
  dateTo: string,
): boolean {
  const day = resolveTripWeekDate(trip)
  if (!day) return false
  return day >= dateFrom && day <= dateTo
}

function costDateInRange(occurredAt: string | null | undefined, dateFrom: string, dateTo: string): boolean {
  if (!occurredAt) return false
  const day = normalizeDateOnly(occurredAt.length >= 10 ? occurredAt.slice(0, 10) : occurredAt)
  if (!day) return false
  return day >= dateFrom && day <= dateTo
}

function extractWeeklyPlatformCandidates(
  weekly: { snapshotJson?: Record<string, unknown> | null },
): Array<{
  id: string
  status: string
  platform?: string | null
  revenueAmount?: string | null
  metadata?: Record<string, unknown> | null
}> {
  const tripsRaw = weekly.snapshotJson?.trips
  if (!Array.isArray(tripsRaw)) return []
  const out: Array<{
    id: string
    status: string
    platform?: string | null
    revenueAmount?: string | null
    metadata?: Record<string, unknown> | null
  }> = []
  for (const item of tripsRaw) {
    if (!item || typeof item !== 'object') continue
    const trip = item as Record<string, unknown>
    if (typeof trip.id !== 'string') continue
    out.push({
      id: trip.id,
      status: typeof trip.status === 'string' ? trip.status : 'completed',
      platform: typeof trip.platform === 'string' ? trip.platform : null,
      revenueAmount:
        trip.revenueAmount == null
          ? null
          : typeof trip.revenueAmount === 'number' || typeof trip.revenueAmount === 'string'
            ? String(trip.revenueAmount)
            : null,
      metadata:
        typeof trip.paymentType === 'string'
          ? { tripRequest: { paymentType: trip.paymentType } }
          : trip.metadata && typeof trip.metadata === 'object'
            ? (trip.metadata as Record<string, unknown>)
            : null,
    })
  }
  return out
}

function resolveSegmentPayout(
  schedule: DriverPayoutSchedule | undefined,
  fallbackPercent: number | undefined,
  netAmount: number,
): ResolvedSettlementPayout {
  if (schedule) return resolveSettlementPayoutPercent(schedule, netAmount)
  return {
    mode: 'fixed',
    percent: Number(fallbackPercent ?? 0) || 0,
    selectionNetAmount: netAmount,
    tiers: null,
    matchedTier: null,
  }
}

function toSegmentPayoutResolution(
  resolved: ResolvedSettlementPayout,
): MonthlySettlementSegment['payoutResolution'] {
  return {
    mode: resolved.mode,
    percent: resolved.percent,
    selectionNetAmount: resolved.selectionNetAmount,
    matchedTier: resolved.matchedTier
      ? {
          fromAmount: resolved.matchedTier.source.fromAmount ?? 0,
          toAmount: resolved.matchedTier.source.toAmount,
          percent: resolved.matchedTier.percent,
        }
      : null,
  }
}

export function buildMonthlySettlementSegments(params: {
  defs: MonthlySettlementSegmentDef[]
  calendarTrips: Array<{
    id: string
    startedAt?: Date | null
    endedAt?: Date | null
    status: string
    platform?: string | null
    revenueAmount?: string | null
    metadata?: Record<string, unknown> | null
  }>
  costEntries: SettlementCostEntrySnapshot[]
  weekliesByWeekStart: Map<
    string,
    {
      id: string
      weekStart: string
      snapshotJson?: Record<string, unknown> | null
      payoutAmount?: string | number | null
    }
  >
  alreadySettled: ReadonlySet<string>
  priorStraddleAttributedByWeekStart?: ReadonlyMap<string, number>
  payoutSchedule?: DriverPayoutSchedule
  payoutPercent?: number
}): {
  segments: MonthlySettlementSegment[]
  platformTripIds: string[]
  skippedAlreadySettled: string[]
  segmentsPayoutBase: number
} {
  const segments: MonthlySettlementSegment[] = []
  const platformTripIds: string[] = []
  const skippedAlreadySettled: string[] = []
  const claimedThisMonth = new Set<string>()
  let segmentsPayoutBase = 0
  const priorAttributed =
    params.priorStraddleAttributedByWeekStart ?? new Map<string, number>()

  for (const def of params.defs) {
    const calendarInRange = params.calendarTrips.filter((trip) =>
      tripDateInRange(trip, def.dateFrom, def.dateTo),
    )
    const nonPlatform = buildNonPlatformRevenueFromCalendarTrips(calendarInRange)
    const costsInRange = params.costEntries.filter((entry) =>
      costDateInRange(entry.occurredAt, def.dateFrom, def.dateTo),
    )
    let costsGross = 0
    let costsNet = 0
    for (const entry of costsInRange) {
      costsGross += entry.amount
      costsNet += entry.netAmount
    }

    let platformRevenueGross = 0
    let platformRevenueNet = 0
    let segmentPlatformIds: string[] = []
    let weeklySettlementId: string | null = null
    const segmentWeekStart =
      def.weekStart ?? (def.kind === 'leading' ? getIsoWeekStart(def.dateFrom) : null)
    const weekly =
      segmentWeekStart != null ? params.weekliesByWeekStart.get(segmentWeekStart) ?? null : null

    if (def.kind === 'week' && segmentWeekStart) {
      weeklySettlementId = weekly?.id ?? null
      const candidates = weekly ? extractWeeklyPlatformCandidates(weekly) : []
      const filtered = filterPlatformTripsForMonthly(candidates, params.alreadySettled)
      for (const id of filtered.skippedAlreadySettled) {
        if (!skippedAlreadySettled.includes(id)) skippedAlreadySettled.push(id)
      }
      const included = filtered.included.filter((trip) => !claimedThisMonth.has(trip.id))
      for (const trip of included) claimedThisMonth.add(trip.id)
      segmentPlatformIds = included.map((trip) => trip.id)
      for (const id of segmentPlatformIds) platformTripIds.push(id)
      const platformRevenue = buildSettlementRevenueFromTrips(included)
      platformRevenueGross = platformRevenue.revenueGross
      platformRevenueNet = platformRevenue.revenueNet
    } else if (def.kind === 'leading') {
      weeklySettlementId = weekly?.id ?? null
    }

    const revenueGross = nonPlatform.revenueGross + platformRevenueGross
    const revenueNet = nonPlatform.revenueNet + platformRevenueNet
    const netAmount = revenueNet - costsNet

    const trailingPartial =
      def.kind === 'week' &&
      segmentWeekStart != null &&
      def.dateTo < getWeekEnd(segmentWeekStart)

    let payoutResolution = resolveSegmentPayout(
      params.payoutSchedule,
      params.payoutPercent,
      netAmount,
    )
    let payoutAmount = computeDriverPayoutBaseAmount(netAmount, payoutResolution.percent)
    let straddle: MonthlySettlementSegmentStraddle | null = null

    if (def.kind === 'leading') {
      // Leading days belong to a week that started in the prior month.
      // Payout % lives on the weekly report; monthly pays only the remainder:
      // weekly.payoutAmount − prior month trailing segment payout for the same weekStart.
      const weeklyPayoutAmount = weekly
        ? toNumber(
            typeof weekly.payoutAmount === 'number'
              ? String(weekly.payoutAmount)
              : weekly.payoutAmount ?? null,
          )
        : 0
      const priorAttributedPayout = priorAttributed.get(segmentWeekStart ?? '') ?? 0
      payoutAmount = computeLeadingRemainderPayout({
        weeklyPayoutAmount,
        priorAttributedPayout,
      })
      payoutResolution = {
        mode: 'weekly_remainder',
        percent: 0,
        selectionNetAmount: netAmount,
        tiers: null,
        matchedTier: null,
      }
      straddle = {
        role: 'leading_remainder',
        weeklyPayoutAmount,
        priorAttributedPayout,
      }
    } else if (trailingPartial && weekly) {
      const weeklyPayoutAmount = toNumber(
        typeof weekly.payoutAmount === 'number'
          ? String(weekly.payoutAmount)
          : weekly.payoutAmount ?? null,
      )
      straddle = {
        role: 'trailing_partial',
        weeklyPayoutAmount,
      }
    }

    segmentsPayoutBase += payoutAmount

    const resolutionForSnapshot = toSegmentPayoutResolution(payoutResolution)
    if (straddle?.role === 'leading_remainder') {
      resolutionForSnapshot.weeklyPayoutAmount = straddle.weeklyPayoutAmount
      resolutionForSnapshot.priorAttributedPayout = straddle.priorAttributedPayout
    }

    segments.push({
      id: def.id,
      kind: def.kind,
      dateFrom: def.dateFrom,
      dateTo: def.dateTo,
      weekStart: segmentWeekStart,
      weeklySettlementId,
      revenueGross,
      revenueNet,
      costsGross,
      costsNet,
      netAmount,
      payoutPercent: straddle?.role === 'leading_remainder' ? 0 : payoutResolution.percent,
      payoutAmount,
      payoutResolution: resolutionForSnapshot,
      straddle,
      nonPlatformTripIds: nonPlatform.nonPlatformTripIds,
      platformTripIds: segmentPlatformIds,
      costEntryIds: costsInRange.map((entry) => entry.id),
    })
  }

  return { segments, platformTripIds, skippedAlreadySettled, segmentsPayoutBase }
}

export function indexWeeklySettlementsByWeekStart(
  weeklies: Array<{ id: string; weekStart: string }>,
): Map<string, WeeklySettlementLink> {
  const map = new Map<string, WeeklySettlementLink>()
  for (const weekly of weeklies) {
    const weekStart = normalizeDateOnly(weekly.weekStart)
    if (!weekStart) continue
    map.set(weekStart, { id: weekly.id, weekStart })
  }
  return map
}

export function indexTripIdsToWeeklyFromSnapshots(
  weeklies: Array<{ id: string; weekStart: string; snapshotJson?: Record<string, unknown> | null }>,
): Map<string, WeeklySettlementLink> {
  const map = new Map<string, WeeklySettlementLink>()
  for (const weekly of weeklies) {
    const weekStart = normalizeDateOnly(weekly.weekStart)
    if (!weekStart) continue
    const link: WeeklySettlementLink = { id: weekly.id, weekStart }
    const tripsRaw = weekly.snapshotJson?.trips
    if (!Array.isArray(tripsRaw)) continue
    for (const item of tripsRaw) {
      if (!item || typeof item !== 'object') continue
      const trip = item as Record<string, unknown>
      if (typeof trip.id !== 'string' || !trip.id) continue
      if (!map.has(trip.id)) {
        map.set(trip.id, link)
      }
    }
  }
  return map
}

export function resolveWeeklyLinkForDate(
  dateInput: string | Date | null | undefined,
  weekliesByWeekStart: ReadonlyMap<string, WeeklySettlementLink>,
): WeeklySettlementLink | null {
  if (dateInput == null) return null
  const dateOnly =
    typeof dateInput === 'string'
      ? normalizeDateOnly(dateInput.length >= 10 ? dateInput.slice(0, 10) : dateInput)
      : normalizeDateOnly(dateInput)
  if (!dateOnly) return null
  const weekStart = getIsoWeekStart(dateOnly)
  return weekliesByWeekStart.get(weekStart) ?? null
}

export function buildMonthlySettlementTripLines(params: {
  calendarTrips: Array<{
    id: string
    startedAt?: Date | null
    endedAt?: Date | null
    status: string
    tripType: string
    platform?: string | null
    distanceKm?: string | null
    revenueAmount?: string | null
    metadata?: Record<string, unknown> | null
  }>
  nonPlatformTripIds: string[]
  platformTripIds: string[]
  weekliesInMonth: Array<{ id: string; weekStart: string; snapshotJson?: Record<string, unknown> | null }>
  tripIdToWeekly: ReadonlyMap<string, WeeklySettlementLink>
  tripIdToSegmentId?: ReadonlyMap<string, string>
}): MonthlySettlementTripLine[] {
  const nonPlatformSet = new Set(params.nonPlatformTripIds)
  const platformSet = new Set(params.platformTripIds)
  const lines: MonthlySettlementTripLine[] = []
  const seen = new Set<string>()

  const calendarIncluded = params.calendarTrips.filter((trip) => nonPlatformSet.has(trip.id))
  const distance = buildSettlementDistanceFromTrips(calendarIncluded)
  for (const trip of distance.trips) {
    if (seen.has(trip.id)) continue
    seen.add(trip.id)
    const link = params.tripIdToWeekly.get(trip.id) ?? null
    lines.push({
      ...trip,
      weeklySettlementId: link?.id ?? null,
      weekStart: link?.weekStart ?? null,
      inclusionSource: 'calendar_non_platform',
      segmentId: params.tripIdToSegmentId?.get(trip.id) ?? null,
    })
  }

  for (const weekly of params.weekliesInMonth) {
    const weekStart = normalizeDateOnly(weekly.weekStart)
    const tripsRaw = weekly.snapshotJson?.trips
    if (!Array.isArray(tripsRaw)) continue
    for (const item of tripsRaw) {
      if (!item || typeof item !== 'object') continue
      const snapshot = parseWeeklyTripSnapshot(item as Record<string, unknown>)
      if (!snapshot || !platformSet.has(snapshot.id) || seen.has(snapshot.id)) continue
      seen.add(snapshot.id)
      lines.push({
        ...snapshot,
        weeklySettlementId: weekly.id,
        weekStart: weekStart || null,
        inclusionSource: 'platform_weekly',
        segmentId: params.tripIdToSegmentId?.get(snapshot.id) ?? null,
      })
    }
  }

  lines.sort((left, right) => {
    const leftDate = left.startedAt ?? left.endedAt ?? ''
    const rightDate = right.startedAt ?? right.endedAt ?? ''
    return leftDate.localeCompare(rightDate)
  })
  return lines
}

export function buildMonthlySettlementCostLines(params: {
  entries: SettlementCostEntrySnapshot[]
  weekliesByWeekStart: ReadonlyMap<string, WeeklySettlementLink>
  costIdToSegmentId?: ReadonlyMap<string, string>
}): MonthlySettlementCostLine[] {
  return params.entries.map((entry) => {
    const link = resolveWeeklyLinkForDate(entry.occurredAt, params.weekliesByWeekStart)
    return {
      ...entry,
      weeklySettlementId: link?.id ?? null,
      weekStart: link?.weekStart ?? null,
      segmentId: params.costIdToSegmentId?.get(entry.id) ?? null,
    }
  })
}

export async function calculateMonthlySettlementForDriver(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    teamMemberId: string
    monthStart: string
    payoutPercent?: number
    payoutSchedule?: DriverPayoutSchedule
    /** @deprecated Monthly cash handover is derived from weeklies; ignored. */
    cashCollected?: number
    bonusAmount?: number
    compensationAmount?: number
    airportA4Amount?: number
    totalDistanceKm?: number
    excludedEntryIds?: ReadonlySet<string>
    /** When recalculating an existing row, exclude its own prior claim set from "already settled". */
    excludeMonthlySettlementId?: string
  },
): Promise<MonthlySettlementTotals> {
  if (!isMonthFullyCompleted(params.monthStart)) {
    throw new Error('MONTH_NOT_COMPLETED')
  }

  const monthEnd = getMonthEnd(params.monthStart)
  const linkingWeekStartFrom = addDays(params.monthStart, -6)

  const priorMonthlies = await findWithDecryption(
    em,
    TaxiFleetMonthlySettlement,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      teamMemberId: params.teamMemberId,
      deletedAt: null,
      monthStart: { $lt: params.monthStart },
      ...(params.excludeMonthlySettlementId
        ? { id: { $ne: params.excludeMonthlySettlementId } }
        : {}),
    },
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )
  const alreadySettled = collectAlreadySettledPlatformTripIds(priorMonthlies)

  const [calendarTrips, costs, linkingWeeklies] = await Promise.all([
    loadDriverTripsInDateRange(em, {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      teamMemberId: params.teamMemberId,
      dateFrom: params.monthStart,
      dateTo: monthEnd,
    }),
    calculateSettlementCosts(em, {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      teamMemberId: params.teamMemberId,
      dateFrom: params.monthStart,
      dateTo: monthEnd,
      excludedEntryIds: params.excludedEntryIds,
    }),
    findWithDecryption(
      em,
      TaxiFleetWeeklySettlement,
      {
        tenantId: params.tenantId,
        organizationId: params.organizationId,
        teamMemberId: params.teamMemberId,
        deletedAt: null,
        weekStart: { $gte: linkingWeekStartFrom, $lte: monthEnd },
      },
      undefined,
      { tenantId: params.tenantId, organizationId: params.organizationId },
    ),
  ])

  linkingWeeklies.sort((a, b) => a.weekStart.localeCompare(b.weekStart))
  const weeklies = linkingWeeklies.filter((weekly) => {
    const weekStart = normalizeDateOnly(weekly.weekStart)
    return weekStart >= params.monthStart && weekStart <= monthEnd
  })

  const weekliesByWeekStartFull = new Map<
    string,
    {
      id: string
      weekStart: string
      snapshotJson?: Record<string, unknown> | null
      payoutAmount?: string | number | null
    }
  >()
  for (const weekly of linkingWeeklies) {
    const weekStart = normalizeDateOnly(weekly.weekStart)
    if (!weekStart) continue
    weekliesByWeekStartFull.set(weekStart, {
      id: weekly.id,
      weekStart,
      snapshotJson: weekly.snapshotJson ?? null,
      payoutAmount: weekly.payoutAmount,
    })
  }

  const priorStraddleAttributedByWeekStart = collectPriorStraddleAttributedPayouts(priorMonthlies)

  const segmentDefs = buildMonthlySettlementSegmentDefs(params.monthStart)
  const built = buildMonthlySettlementSegments({
    defs: segmentDefs,
    calendarTrips,
    costEntries: costs.entries,
    weekliesByWeekStart: weekliesByWeekStartFull,
    alreadySettled,
    priorStraddleAttributedByWeekStart,
    payoutSchedule: params.payoutSchedule,
    payoutPercent: params.payoutPercent,
  })

  const nonPlatform = buildNonPlatformRevenueFromCalendarTrips(calendarTrips)
  const platformTripsForBreakdown: Array<{
    id: string
    status: string
    platform?: string | null
    revenueAmount?: string | null
    metadata?: Record<string, unknown> | null
  }> = []
  for (const weekly of weeklies) {
    for (const trip of extractWeeklyPlatformCandidates(weekly)) {
      if (built.platformTripIds.includes(trip.id)) platformTripsForBreakdown.push(trip)
    }
  }
  const platformRevenue = buildSettlementRevenueFromTrips(platformTripsForBreakdown)
  const revenueBreakdown = mergeRevenueBreakdowns(nonPlatform.breakdown, platformRevenue.breakdown)
  const revenueGross = nonPlatform.revenueGross + platformRevenue.revenueGross
  const revenueNet = nonPlatform.revenueNet + platformRevenue.revenueNet
  const netAmount = revenueNet - costs.costsNet

  const bonus = Math.max(0, Number(params.bonusAmount ?? 0))
  const compensation = Math.max(0, Number(params.compensationAmount ?? 0))
  const payoutAmount = built.segmentsPayoutBase + bonus + compensation
  const payoutPercent = 0
  const payoutResolution: ResolvedSettlementPayout = {
    mode: params.payoutSchedule?.mode ?? 'fixed',
    percent: 0,
    selectionNetAmount: netAmount,
    tiers: params.payoutSchedule?.tiers ?? null,
    matchedTier: null,
  }

  let computedDistanceKm = 0
  for (const trip of calendarTrips) {
    computedDistanceKm += toNumber(trip.distanceKm)
  }
  const totalDistanceKm = params.totalDistanceKm ?? computedDistanceKm
  const emptyDistanceKm = Math.max(0, totalDistanceKm - computedDistanceKm)

  // Monthly payout is transfer-only; cash handover stays on weeklies (control).
  const transferAmount = computeTransferAmount({
    payoutAmount,
    cashExpected: 0,
    cashCollected: 0,
    airportA4Amount: params.airportA4Amount ?? 0,
  })

  const tripIdToSegmentId = new Map<string, string>()
  const costIdToSegmentId = new Map<string, string>()
  for (const segment of built.segments) {
    for (const id of segment.nonPlatformTripIds) tripIdToSegmentId.set(id, segment.id)
    for (const id of segment.platformTripIds) tripIdToSegmentId.set(id, segment.id)
    for (const id of segment.costEntryIds) costIdToSegmentId.set(id, segment.id)
  }

  const weekliesByWeekStart = indexWeeklySettlementsByWeekStart(linkingWeeklies)
  const tripIdToWeekly = indexTripIdsToWeeklyFromSnapshots(linkingWeeklies)
  const tripLines = buildMonthlySettlementTripLines({
    calendarTrips,
    nonPlatformTripIds: nonPlatform.nonPlatformTripIds,
    platformTripIds: built.platformTripIds,
    weekliesInMonth: weeklies,
    tripIdToWeekly,
    tripIdToSegmentId,
  })
  const costLines = buildMonthlySettlementCostLines({
    entries: costs.entries,
    weekliesByWeekStart,
    costIdToSegmentId,
  })

  const snapshot: MonthlySettlementSnapshot = {
    monthStart: params.monthStart,
    monthEnd,
    teamMemberId: params.teamMemberId,
    weeklySettlementIds: weeklies.map((w) => w.id),
    weeklyCount: weeklies.length,
    revenueBreakdown,
    platformTripIds: built.platformTripIds,
    platformTripIdsSkippedAlreadySettled: built.skippedAlreadySettled,
    nonPlatformTripIds: nonPlatform.nonPlatformTripIds,
    calendarCashTripIds: nonPlatform.calendarCashTripIds,
    segments: built.segments,
    trips: tripLines,
    costs: costLines,
    payout: {
      mode: 'segmented',
      segmentsCount: built.segments.length,
      transferOnly: true,
    },
  }

  return {
    revenueGross,
    revenueNet,
    costsGross: costs.costsGross,
    costsNet: costs.costsNet,
    netAmount,
    payoutPercent,
    payoutAmount,
    totalDistanceKm,
    computedDistanceKm,
    emptyDistanceKm,
    cashExpected: 0,
    cashCollected: 0,
    transferAmount,
    weeklyCount: weeklies.length,
    revenueBreakdown,
    payoutResolution,
    snapshot,
  }
}

/** @deprecated Use calculateMonthlySettlementForDriver — kept name for call-site migration. */
export async function calculateMonthlySettlement(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    teamMemberId: string
    monthStart: string
    payoutPercent?: number
    payoutSchedule?: DriverPayoutSchedule
    cashCollected?: number
    bonusAmount?: number
    compensationAmount?: number
    airportA4Amount?: number
    totalDistanceKm?: number
    excludedEntryIds?: ReadonlySet<string>
    excludeMonthlySettlementId?: string
  },
): Promise<MonthlySettlementTotals> {
  return calculateMonthlySettlementForDriver(em, params)
}
