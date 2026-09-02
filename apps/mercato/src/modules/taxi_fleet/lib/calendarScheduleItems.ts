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
  platform?: string | null
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
  resolveDriverColor?: (teamMemberId: string) => string | null
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

const TRIP_STATUS_FALLBACK_COLORS: Record<string, string> = {
  new: '#64748b',
  approved: '#3b82f6',
  paid: '#10b981',
  scheduled: '#f59e0b',
  completed: '#22c55e',
  cancelled: '#ef4444',
}

const ASSIGNMENT_STATUS_FALLBACK_COLORS: Record<string, string> = {
  planned: '#94a3b8',
  confirmed: '#10b981',
  completed: '#059669',
  cancelled: '#94a3b8',
}

/** Stable, distinct hues for calendar coloring by driver. */
const DRIVER_CALENDAR_PALETTE = [
  '#2563eb',
  '#059669',
  '#d97706',
  '#db2777',
  '#7c3aed',
  '#0891b2',
  '#ea580c',
  '#4f46e5',
  '#16a34a',
  '#c026d3',
  '#0d9488',
  '#e11d48',
] as const

export function resolveStableDriverColor(teamMemberId: string): string {
  const id = teamMemberId.trim()
  let hash = 2166136261
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return DRIVER_CALENDAR_PALETTE[hash % DRIVER_CALENDAR_PALETTE.length]
}

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUnresolvedIdLabel(value: string): boolean {
  return UUID_LIKE.test(value.trim())
}

function resolveHumanLabel(id: string | null | undefined, resolve: (id: string) => string): string | null {
  if (!id) return null
  const label = resolve(id)?.trim()
  if (!label || isUnresolvedIdLabel(label) || label === id) return null
  return label
}

function truncateLabel(value: string, max = 28): string {
  const trimmed = value.trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max - 1)}…`
}

function resolveEventColor(params: {
  teamMemberId?: string | null
  resourceId?: string | null
  statusKey: string
  fallbackMap: Record<string, string>
  resolvers: FleetCalendarLabelResolvers
}): string | undefined {
  if (params.teamMemberId) {
    const fromDriver = params.resolvers.resolveDriverColor?.(params.teamMemberId)?.trim()
    if (fromDriver) return fromDriver
    return resolveStableDriverColor(params.teamMemberId)
  }
  if (params.resourceId) {
    const fromResource = params.resolvers.resolveResourceColor?.(params.resourceId)?.trim()
    if (fromResource) return fromResource
  }
  return params.fallbackMap[params.statusKey] ?? params.fallbackMap[normalizeTripStatus(params.statusKey)]
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
      const driverName = resolveHumanLabel(assignment.teamMemberId, resolvers.resolveDriverName)
      const vehicleLabel = resolveHumanLabel(assignment.resourceId, resolvers.resolveResourceLabel)
      const titleParts = [driverName, vehicleLabel].filter(Boolean)
      const color = resolveEventColor({
        teamMemberId: assignment.teamMemberId,
        resourceId: assignment.resourceId,
        statusKey: assignment.status,
        fallbackMap: ASSIGNMENT_STATUS_FALLBACK_COLORS,
        resolvers,
      })
      return {
        id: `assignment-${assignment.id}`,
        kind: 'availability' as const,
        title: titleParts.join(' · ') || 'Assignment',
        startsAt: start,
        endsAt: end,
        status: ASSIGNMENT_STATUS_MAP[assignment.status] ?? 'draft',
        subjectType: 'member' as const,
        subjectId: assignment.teamMemberId,
        color,
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
      const vehicleLabel = resolveHumanLabel(trip.resourceId, resolvers.resolveResourceLabel)
      const tripTypeLabel = resolvers.resolveTripTypeLabel(trip.tripType)
      const driverName = trip.teamMemberId
        ? resolveHumanLabel(trip.teamMemberId, resolvers.resolveDriverName)
        : resolvers.resolveUnscheduledDriverLabel?.() ?? null
      const route = resolveTripCalendarRoute(trip)
      const routeSummary =
        route.fromAddress && route.toAddress
          ? `${truncateLabel(route.fromAddress, 22)} → ${truncateLabel(route.toAddress, 22)}`
          : route.fromAddress || route.toAddress || ''
      const title = options?.omitDriverInTitle
        ? routeSummary || vehicleLabel || tripTypeLabel
        : [driverName, routeSummary || vehicleLabel].filter(Boolean).join(' · ') || tripTypeLabel
      const color = resolveEventColor({
        teamMemberId: trip.teamMemberId,
        resourceId: trip.resourceId,
        statusKey: normalizeTripStatus(trip.status),
        fallbackMap: TRIP_STATUS_FALLBACK_COLORS,
        resolvers,
      })
      return [{
        id: `trip-${trip.id}`,
        kind: 'event' as const,
        title,
        startsAt: start,
        endsAt: end,
        status: TRIP_STATUS_MAP[normalizeTripStatus(trip.status)] ?? TRIP_STATUS_MAP[trip.status] ?? 'draft',
        subjectType: 'member' as const,
        subjectId: trip.teamMemberId ?? undefined,
        color,
        metadata: {
          recordType: 'trip',
          tripId: trip.id,
          resourceId: trip.resourceId,
          tripType: trip.tripType,
          tripStatus: trip.status,
          platform: trip.platform ?? null,
          driverName,
          vehicleLabel,
          fromAddress: route.fromAddress,
          toAddress: route.toAddress,
          routeSummary,
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
