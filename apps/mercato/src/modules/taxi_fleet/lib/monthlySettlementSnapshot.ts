import type { TripRequestPaymentType } from './tripRequestForm'
import { normalizeDateOnly } from './weekUtils'

/** Client-safe trip snapshot shape (mirrors weekly settlement trip lines). */
export type SettlementTripSnapshotFields = {
  id: string
  startedAt: string | null
  endedAt: string | null
  status: string
  tripType: string
  platform: string | null
  paymentType?: TripRequestPaymentType
  revenueAmount: number | null
  distanceKm: number | null
  missingDistance: boolean
  missingPlatform: boolean
  missingIncomeReceipt: boolean
}

export type MonthlySettlementTripLine = SettlementTripSnapshotFields & {
  weeklySettlementId: string | null
  weekStart: string | null
  inclusionSource: 'calendar_non_platform' | 'platform_weekly'
  segmentId: string | null
}

export type MonthlySettlementCostLine = {
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
  weeklySettlementId: string | null
  weekStart: string | null
  segmentId: string | null
}

export type MonthlySettlementSegmentKind = 'leading' | 'week'

export type MonthlySettlementSegmentPayoutResolution = {
  mode: string
  percent: number
  selectionNetAmount: number
  matchedTier: {
    fromAmount: number
    toAmount: number | null
    percent: number
  } | null
  /** Present when mode is `weekly_remainder` (leading straddle). */
  weeklyPayoutAmount?: number
  priorAttributedPayout?: number
}

export type MonthlySettlementSegmentStraddle = {
  role: 'leading_remainder' | 'trailing_partial'
  weeklyPayoutAmount: number
  priorAttributedPayout?: number
}

export type MonthlySettlementSegment = {
  id: string
  kind: MonthlySettlementSegmentKind
  dateFrom: string
  dateTo: string
  weekStart: string | null
  weeklySettlementId: string | null
  revenueGross: number
  revenueNet: number
  costsGross: number
  costsNet: number
  netAmount: number
  payoutPercent: number
  payoutAmount: number
  payoutResolution: MonthlySettlementSegmentPayoutResolution
  straddle: MonthlySettlementSegmentStraddle | null
  nonPlatformTripIds: string[]
  platformTripIds: string[]
  costEntryIds: string[]
}

/** @deprecated Org-level monthly rollup was replaced by per-driver settlements. */
export type MonthlyDriverBreakdownLine = {
  teamMemberId: string
  revenueGross: number
  revenueNet: number
  costsGross: number
  costsNet: number
  netAmount: number
  payoutAmount: number
  transferAmount: number
  totalAmount: number
  totalDistanceKm: number
  weeklyCount: number
}

export function parseWeeklyTripSnapshot(item: Record<string, unknown>): SettlementTripSnapshotFields | null {
  if (typeof item.id !== 'string' || !item.id) return null
  const revenueRaw = item.revenueAmount
  const revenueAmount =
    typeof revenueRaw === 'number'
      ? revenueRaw
      : typeof revenueRaw === 'string'
        ? Number(revenueRaw)
        : null
  const distanceRaw = item.distanceKm
  const distanceKm =
    typeof distanceRaw === 'number'
      ? distanceRaw
      : typeof distanceRaw === 'string'
        ? Number(distanceRaw)
        : null
  return {
    id: item.id,
    startedAt: typeof item.startedAt === 'string' ? item.startedAt : null,
    endedAt: typeof item.endedAt === 'string' ? item.endedAt : null,
    status: typeof item.status === 'string' ? item.status : 'completed',
    tripType: typeof item.tripType === 'string' ? item.tripType : 'standard',
    platform: typeof item.platform === 'string' ? item.platform : null,
    paymentType:
      item.paymentType === 'cash' ||
      item.paymentType === 'card' ||
      item.paymentType === 'electronic' ||
      item.paymentType === 'transfer' ||
      item.paymentType === 'other'
        ? item.paymentType
        : undefined,
    revenueAmount: revenueAmount != null && Number.isFinite(revenueAmount) ? revenueAmount : null,
    distanceKm: distanceKm != null && Number.isFinite(distanceKm) ? distanceKm : null,
    missingDistance: Boolean(item.missingDistance),
    missingPlatform: Boolean(item.missingPlatform),
    missingIncomeReceipt: Boolean(item.missingIncomeReceipt),
  }
}

export function parseMonthlySettlementTrips(
  snapshotJson?: Record<string, unknown> | null,
): MonthlySettlementTripLine[] {
  const raw = snapshotJson?.trips
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => {
      const base = parseWeeklyTripSnapshot(item)
      if (!base) return null
      const weeklySettlementId =
        typeof item.weeklySettlementId === 'string' ? item.weeklySettlementId : null
      const weekStart =
        typeof item.weekStart === 'string' ? normalizeDateOnly(item.weekStart) || null : null
      const inclusionSource =
        item.inclusionSource === 'platform_weekly' ? 'platform_weekly' : 'calendar_non_platform'
      return {
        ...base,
        weeklySettlementId,
        weekStart,
        inclusionSource,
        segmentId: typeof item.segmentId === 'string' ? item.segmentId : null,
      } satisfies MonthlySettlementTripLine
    })
    .filter((item): item is MonthlySettlementTripLine => item != null)
}

export function parseMonthlySettlementCosts(
  snapshotJson?: Record<string, unknown> | null,
): MonthlySettlementCostLine[] {
  const raw = snapshotJson?.costs
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => {
      if (typeof item.id !== 'string' || !item.id) return null
      const amount = typeof item.amount === 'number' ? item.amount : Number(item.amount)
      const netAmount =
        typeof item.netAmount === 'number' ? item.netAmount : Number(item.netAmount)
      const vatRatePercent =
        typeof item.vatRatePercent === 'number'
          ? item.vatRatePercent
          : Number(item.vatRatePercent ?? 23)
      return {
        id: item.id,
        costType: typeof item.costType === 'string' ? item.costType : null,
        tripId: typeof item.tripId === 'string' ? item.tripId : null,
        amount: Number.isFinite(amount) ? amount : 0,
        vatRatePercent: Number.isFinite(vatRatePercent) ? vatRatePercent : 23,
        netAmount: Number.isFinite(netAmount) ? netAmount : 0,
        currencyCode: typeof item.currencyCode === 'string' ? item.currencyCode : 'PLN',
        documentNumber: typeof item.documentNumber === 'string' ? item.documentNumber : null,
        occurredAt: typeof item.occurredAt === 'string' ? item.occurredAt : null,
        notes: typeof item.notes === 'string' ? item.notes : null,
        receiptAttachmentId:
          typeof item.receiptAttachmentId === 'string' ? item.receiptAttachmentId : null,
        weeklySettlementId:
          typeof item.weeklySettlementId === 'string' ? item.weeklySettlementId : null,
        weekStart:
          typeof item.weekStart === 'string' ? normalizeDateOnly(item.weekStart) || null : null,
        segmentId: typeof item.segmentId === 'string' ? item.segmentId : null,
      } satisfies MonthlySettlementCostLine
    })
    .filter((item): item is MonthlySettlementCostLine => item != null)
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function parseMonthlySettlementSegments(
  snapshotJson?: Record<string, unknown> | null,
): MonthlySettlementSegment[] {
  const raw = snapshotJson?.segments
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => {
      if (typeof item.id !== 'string' || !item.id) return null
      const kind: MonthlySettlementSegmentKind = item.kind === 'leading' ? 'leading' : 'week'
      const dateFrom = typeof item.dateFrom === 'string' ? normalizeDateOnly(item.dateFrom) : ''
      const dateTo = typeof item.dateTo === 'string' ? normalizeDateOnly(item.dateTo) : ''
      if (!dateFrom || !dateTo) return null
      const resolutionRaw =
        item.payoutResolution && typeof item.payoutResolution === 'object'
          ? (item.payoutResolution as Record<string, unknown>)
          : null
      const matchedRaw =
        resolutionRaw?.matchedTier && typeof resolutionRaw.matchedTier === 'object'
          ? (resolutionRaw.matchedTier as Record<string, unknown>)
          : null
      const stringIds = (value: unknown): string[] =>
        Array.isArray(value)
          ? value.filter((id): id is string => typeof id === 'string' && id.length > 0)
          : []
      return {
        id: item.id,
        kind,
        dateFrom,
        dateTo,
        weekStart:
          typeof item.weekStart === 'string' ? normalizeDateOnly(item.weekStart) || null : null,
        weeklySettlementId:
          typeof item.weeklySettlementId === 'string' ? item.weeklySettlementId : null,
        revenueGross: toFiniteNumber(item.revenueGross),
        revenueNet: toFiniteNumber(item.revenueNet),
        costsGross: toFiniteNumber(item.costsGross),
        costsNet: toFiniteNumber(item.costsNet),
        netAmount: toFiniteNumber(item.netAmount),
        payoutPercent: toFiniteNumber(item.payoutPercent),
        payoutAmount: toFiniteNumber(item.payoutAmount),
        payoutResolution: {
          mode: typeof resolutionRaw?.mode === 'string' ? resolutionRaw.mode : 'fixed',
          percent: toFiniteNumber(resolutionRaw?.percent),
          selectionNetAmount: toFiniteNumber(resolutionRaw?.selectionNetAmount),
          matchedTier: matchedRaw
            ? {
                fromAmount: toFiniteNumber(matchedRaw.fromAmount),
                toAmount:
                  matchedRaw.toAmount == null ? null : toFiniteNumber(matchedRaw.toAmount),
                percent: toFiniteNumber(matchedRaw.percent),
              }
            : null,
          weeklyPayoutAmount:
            resolutionRaw?.weeklyPayoutAmount == null
              ? undefined
              : toFiniteNumber(resolutionRaw.weeklyPayoutAmount),
          priorAttributedPayout:
            resolutionRaw?.priorAttributedPayout == null
              ? undefined
              : toFiniteNumber(resolutionRaw.priorAttributedPayout),
        },
        straddle: (() => {
          const raw =
            item.straddle && typeof item.straddle === 'object'
              ? (item.straddle as Record<string, unknown>)
              : null
          if (!raw) return null
          if (raw.role !== 'leading_remainder' && raw.role !== 'trailing_partial') return null
          return {
            role: raw.role,
            weeklyPayoutAmount: toFiniteNumber(raw.weeklyPayoutAmount),
            priorAttributedPayout:
              raw.priorAttributedPayout == null
                ? undefined
                : toFiniteNumber(raw.priorAttributedPayout),
          } satisfies MonthlySettlementSegmentStraddle
        })(),
        nonPlatformTripIds: stringIds(item.nonPlatformTripIds),
        platformTripIds: stringIds(item.platformTripIds),
        costEntryIds: stringIds(item.costEntryIds),
      } satisfies MonthlySettlementSegment
    })
    .filter((item): item is MonthlySettlementSegment => item != null)
}
