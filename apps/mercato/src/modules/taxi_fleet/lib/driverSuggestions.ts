import type { EntityManager } from '@mikro-orm/postgresql'
import { findWithDecryption, findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { StaffTeamMember } from '@open-mercato/core/modules/staff/data/entities'
import { PlannerAvailabilityRule } from '@open-mercato/core/modules/planner/data/entities'
import { getMergedAvailabilityWindows } from '@open-mercato/core/modules/planner/lib/availabilityMerge'
import { TaxiFleetDailyAssignment, TaxiFleetDriverProfile, TaxiFleetTrip } from '../data/entities'

export type DriverSuggestion = {
  teamMemberId: string
  profileId: string
  displayName: string
  score: number
  reasons: string[]
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd
}

function isWithinAvailabilityWindow(start: Date, end: Date, windows: { start: Date; end: Date }[]): boolean {
  if (!windows.length) return true
  return windows.some((window) => window.start <= start && window.end >= end)
}

function tripWithinAssignmentWindow(
  startedAt: Date,
  endedAt: Date,
  shiftStart?: Date | null,
  shiftEnd?: Date | null,
): boolean {
  if (!shiftStart || !shiftEnd) return true
  return shiftStart <= startedAt && shiftEnd >= endedAt
}

export async function suggestDriversForTripWindow(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    startedAt: Date
    endedAt: Date
    limit?: number
  },
): Promise<DriverSuggestion[]> {
  const profiles = await findWithDecryption(
    em,
    TaxiFleetDriverProfile,
    { tenantId: params.tenantId, organizationId: params.organizationId, deletedAt: null },
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )
  if (!profiles.length) return []

  const assignmentDate = params.startedAt.toISOString().slice(0, 10)
  const suggestions: DriverSuggestion[] = []

  for (const profile of profiles) {
    const member = await findOneWithDecryption(
      em,
      StaffTeamMember,
      { id: profile.teamMemberId, deletedAt: null, isActive: true },
      undefined,
      { tenantId: params.tenantId, organizationId: params.organizationId },
    )
    if (!member) continue

    const reasons: string[] = []
    let score = 0

    const dayAssignment = await findOneWithDecryption(
      em,
      TaxiFleetDailyAssignment,
      {
        teamMemberId: profile.teamMemberId,
        assignmentDate,
        deletedAt: null,
        status: { $ne: 'cancelled' },
      },
      undefined,
      { tenantId: params.tenantId, organizationId: params.organizationId },
    )
    if (dayAssignment) {
      const windowStart = dayAssignment.shiftStart ?? dayAssignment.plannedShiftStart
      const windowEnd = dayAssignment.shiftEnd ?? dayAssignment.plannedShiftEnd
      if (tripWithinAssignmentWindow(params.startedAt, params.endedAt, windowStart, windowEnd)) {
        score += 50
        reasons.push(windowStart && windowEnd ? 'within_assignment_hours' : 'has_daily_assignment')
      } else {
        score -= 60
        reasons.push('outside_assignment_hours')
      }
    }

    const overlappingTrips = await findWithDecryption(
      em,
      TaxiFleetTrip,
      {
        teamMemberId: profile.teamMemberId,
        deletedAt: null,
        status: { $in: ['new', 'approved', 'paid', 'scheduled'] },
        startedAt: { $lt: params.endedAt },
        endedAt: { $gt: params.startedAt },
      },
      undefined,
      { tenantId: params.tenantId, organizationId: params.organizationId },
    )
    const hasTripConflict = overlappingTrips.some((trip) => {
      if (!trip.startedAt || !trip.endedAt) return false
      return rangesOverlap(params.startedAt, params.endedAt, trip.startedAt, trip.endedAt)
    })
    if (hasTripConflict) {
      score -= 100
      reasons.push('trip_overlap')
    }

    const ruleFilters: Array<Record<string, unknown>> = [
      { subjectType: 'member', subjectId: profile.teamMemberId, deletedAt: null },
    ]
    if (member.availabilityRuleSetId) {
      ruleFilters.push({ subjectType: 'ruleset', subjectId: member.availabilityRuleSetId, deletedAt: null })
    }
    const rules = (await findWithDecryption(
      em,
      PlannerAvailabilityRule,
      { $or: ruleFilters, tenantId: params.tenantId, organizationId: params.organizationId },
      undefined,
      { tenantId: params.tenantId, organizationId: params.organizationId },
    )) as PlannerAvailabilityRule[]

    const windows = getMergedAvailabilityWindows({
      rules: rules.map((rule) => ({
        id: rule.id,
        rrule: rule.rrule,
        exdates: rule.exdates ?? [],
        kind: rule.kind as 'availability' | 'unavailability',
      })),
      range: { start: params.startedAt, end: params.endedAt },
    })
    if (rules.length) {
      if (isWithinAvailabilityWindow(params.startedAt, params.endedAt, windows)) {
        score += 30
        reasons.push('planner_available')
      } else if (windows.length) {
        score -= 40
        reasons.push('planner_unavailable')
      }
    } else {
      reasons.push('no_planner_rules')
    }

    if (score < -50) continue

    suggestions.push({
      teamMemberId: profile.teamMemberId,
      profileId: profile.id,
      displayName: member.displayName,
      score,
      reasons,
    })
  }

  suggestions.sort((a, b) => b.score - a.score || a.displayName.localeCompare(b.displayName))
  const limit = params.limit ?? 5
  return suggestions.slice(0, limit)
}
