import type { ScheduleItem } from '@open-mercato/ui/backend/schedule'
import { tripRequestDetailsFromMetadata } from './tripRequestForm'
import { normalizeTripStatus } from './tripStatuses'

export type CalendarAssignment = {
  id: string
  teamMemberId: string
  resourceId: string
  assignmentDate: string
  shiftStart?: string | null
  shiftEnd?: string | null
  status: string
  /** Defensive: some list payloads may still expose snake_case fields. */
  team_member_id?: string | null
  resource_id?: string | null
  assignment_date?: string | null
  shift_start?: string | null
  shift_end?: string | null
}

export type CalendarTrip = {
  id: string
  teamMemberId?: string | null
  resourceId?: string | null
  tripType: string
  status: string
  startedAt?: string | null
  endedAt?: string | null
  customerPersonId?: string | null
  customerCompanyId?: string | null
  revenueAmount?: string | null
  currencyCode?: string | null
  metadata?: Record<string, unknown> | null
  /** Defensive: some list payloads may still expose snake_case timestamps. */
  started_at?: string | null
  ended_at?: string | null
  team_member_id?: string | null
  resource_id?: string | null
  trip_type?: string | null
}

export type FleetCalendarLabelResolvers = {
  resolveDriverName: (teamMemberId: string) => string
  resolveResourceLabel: (resourceId: string) => string
  resolveTripTypeLabel: (tripType: string) => string
  resolveUnscheduledDriverLabel?: () => string
  resolveResourceColor?: (resourceId: string) => string | null
}

export type TripCalendarRouteMeta = {
  fromAddress: string
  toAddress: string
  stopCount: number
}

const ASSIGNMENT_STATUS_MAP: Record<string, ScheduleItem['status']> = {
  planned: 'draft',
  confirmed: 'confirmed',
  completed: 'confirmed',
  cancelled: 'cancelled',
}

const TRIP_STATUS_MAP: Record<string, ScheduleItem['status']> = {
  new: 'draft',
  approved: 'negotiation',
  paid: 'confirmed',
  scheduled: 'negotiation',
  completed: 'confirmed',
  cancelled: 'cancelled',
  draft: 'draft',
  submitted: 'negotiation',
  rejected: 'cancelled',
}

/** Cancelled / rejected trips stay off planning calendars. */
export function isTripHiddenFromCalendar(status: string | null | undefined): boolean {
  return normalizeTripStatus(status) === 'cancelled'
}

function normalizeCalendarAssignment(assignment: CalendarAssignment): CalendarAssignment {
  return {
    ...assignment,
    teamMemberId: assignment.teamMemberId || assignment.team_member_id || '',
    resourceId: assignment.resourceId || assignment.resource_id || '',
    assignmentDate: assignment.assignmentDate || assignment.assignment_date || '',
    shiftStart: assignment.shiftStart ?? assignment.shift_start ?? null,
    shiftEnd: assignment.shiftEnd ?? assignment.shift_end ?? null,
  }
}

function resolveAssignmentWindow(assignment: CalendarAssignment): { start: Date; end: Date } {
  if (assignment.shiftStart && assignment.shiftEnd) {
    const start = new Date(assignment.shiftStart)
    const end = new Date(assignment.shiftEnd)
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
      return { start, end }
    }
  }
  return {
    start: new Date(`${assignment.assignmentDate}T06:00:00`),
    end: new Date(`${assignment.assignmentDate}T22:00:00`),
  }
}

function matchesTeamMemberFilter(teamMemberId: string | null | undefined, selectedTeamMemberId?: string | null): boolean {
  if (!selectedTeamMemberId) return true
  return teamMemberId === selectedTeamMemberId
}

function matchesResourceFilter(resourceId: string | null | undefined, selectedResourceId?: string | null): boolean {
  if (!selectedResourceId) return true
  return resourceId === selectedResourceId
}

function readTripStartedAt(trip: CalendarTrip): string | null {
  const value = trip.startedAt ?? trip.started_at
  return typeof value === 'string' && value.trim().length ? value : null
}

function readTripEndedAt(trip: CalendarTrip): string | null {
  const value = trip.endedAt ?? trip.ended_at
  return typeof value === 'string' && value.trim().length ? value : null
}

function countWaypointStops(waypointAddresses: string): number {
  return waypointAddresses
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0).length
}

export function resolveTripCalendarRoute(trip: CalendarTrip): TripCalendarRouteMeta {
  const details = tripRequestDetailsFromMetadata(trip.metadata ?? null, {
    revenueAmount: trip.revenueAmount,
  })
  return {
    fromAddress: details.fromAddress,
    toAddress: details.toAddress,
    stopCount: countWaypointStops(details.waypointAddresses),
  }
}

function normalizeCalendarTrip(trip: CalendarTrip): CalendarTrip {
  return {
    ...trip,
    teamMemberId: trip.teamMemberId ?? trip.team_member_id ?? null,
    resourceId: trip.resourceId ?? trip.resource_id ?? null,
    tripType: trip.tripType || trip.trip_type || 'client',
    startedAt: readTripStartedAt(trip),
    endedAt: readTripEndedAt(trip),
    metadata: trip.metadata ?? null,
  }
}

export function mapAssignmentsToScheduleItems(
  assignments: CalendarAssignment[],
  resolvers: FleetCalendarLabelResolvers,
  selectedTeamMemberId?: string | null,
  selectedResourceId?: string | null,
): ScheduleItem[] {
  return assignments
    .map(normalizeCalendarAssignment)
    .filter((assignment) => Boolean(assignment.assignmentDate))
    .filter((assignment) => matchesTeamMemberFilter(assignment.teamMemberId, selectedTeamMemberId))
    .filter((assignment) => matchesResourceFilter(assignment.resourceId, selectedResourceId))
    .map((assignment) => {
      const { start, end } = resolveAssignmentWindow(assignment)
      const driverName = resolvers.resolveDriverName(assignment.teamMemberId)
      const vehicleLabel = resolvers.resolveResourceLabel(assignment.resourceId)
      return {
        id: `assignment-${assignment.id}`,
        kind: 'availability' as const,
        title: `${driverName} · ${vehicleLabel}`,
        startsAt: start,
        endsAt: end,
        status: ASSIGNMENT_STATUS_MAP[assignment.status] ?? 'draft',
        subjectType: 'member' as const,
        subjectId: assignment.teamMemberId,
        metadata: {
          recordType: 'assignment',
          assignmentId: assignment.id,
          resourceId: assignment.resourceId,
          assignmentStatus: assignment.status,
          driverName,
          vehicleLabel,
        },
      }
    })
}

export type FleetCalendarBuildOptions = {
  omitDriverInTitle?: boolean
}

export function mapTripsToScheduleItems(
  trips: CalendarTrip[],
  resolvers: FleetCalendarLabelResolvers,
  selectedTeamMemberId?: string | null,
  options?: FleetCalendarBuildOptions,
  selectedResourceId?: string | null,
): ScheduleItem[] {
  return trips
    .map(normalizeCalendarTrip)
    .filter((trip) => !isTripHiddenFromCalendar(trip.status))
    .filter((trip) => matchesTeamMemberFilter(trip.teamMemberId, selectedTeamMemberId))
    .filter((trip) => matchesResourceFilter(trip.resourceId, selectedResourceId))
    .flatMap((trip) => {
      if (!trip.startedAt) return []
      const start = new Date(trip.startedAt)
      if (Number.isNaN(start.getTime())) return []
      const end = trip.endedAt
        ? new Date(trip.endedAt)
        : new Date(start.getTime() + 60 * 60 * 1000)
      if (Number.isNaN(end.getTime()) || end <= start) return []
      const vehicleLabel = trip.resourceId
        ? resolvers.resolveResourceLabel(trip.resourceId)
        : resolvers.resolveTripTypeLabel('client')
      const tripTypeLabel = resolvers.resolveTripTypeLabel(trip.tripType)
      const driverName = trip.teamMemberId
        ? resolvers.resolveDriverName(trip.teamMemberId)
        : resolvers.resolveUnscheduledDriverLabel?.() ?? '—'
      const route = resolveTripCalendarRoute(trip)
      const title = options?.omitDriverInTitle ? (route.fromAddress || tripTypeLabel) : driverName
      return [{
        id: `trip-${trip.id}`,
        kind: 'event' as const,
        title,
        startsAt: start,
        endsAt: end,
        status: TRIP_STATUS_MAP[normalizeTripStatus(trip.status)] ?? TRIP_STATUS_MAP[trip.status] ?? 'draft',
        subjectType: 'member' as const,
        subjectId: trip.teamMemberId ?? undefined,
        metadata: {
          recordType: 'trip',
          tripId: trip.id,
          resourceId: trip.resourceId,
          tripType: trip.tripType,
          tripStatus: trip.status,
          driverName,
          vehicleLabel,
          fromAddress: route.fromAddress,
          toAddress: route.toAddress,
          stopCount: route.stopCount,
          revenueAmount: trip.revenueAmount ?? null,
          currencyCode: trip.currencyCode ?? null,
          omitDriverInTitle: Boolean(options?.omitDriverInTitle),
        },
      }]
    })
}

export function buildFleetCalendarItems(
  assignments: CalendarAssignment[],
  trips: CalendarTrip[],
  resolvers: FleetCalendarLabelResolvers,
  selectedTeamMemberId?: string | null,
  options?: FleetCalendarBuildOptions,
  selectedResourceId?: string | null,
): ScheduleItem[] {
  return [
    ...mapAssignmentsToScheduleItems(assignments, resolvers, selectedTeamMemberId, selectedResourceId),
    ...mapTripsToScheduleItems(trips, resolvers, selectedTeamMemberId, options, selectedResourceId),
  ]
}
