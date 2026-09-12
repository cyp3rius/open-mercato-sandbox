"use client"

import * as React from 'react'
import {
  ScheduleView,
  type ScheduleItem,
  type ScheduleRange,
  type ScheduleSlot,
  type ScheduleViewMode,
} from '@open-mercato/ui/backend/schedule'
import {
  buildFleetCalendarItems,
  type CalendarAssignment,
  type CalendarTrip,
} from '../lib/calendarScheduleItems'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useTaxiFleetLabels } from './useTaxiFleetLabels'
import type { TripCreateSeed } from './TripCreateDialog'
import { TripScheduleEventCard, AssignmentScheduleEventCard } from './TripScheduleEventCard'
import { TripCalendarDetailsPanel } from './TripCalendarDetailsPanel'
import {
  buildFleetCalendarDriverLegendEntries,
  FleetCalendarDriverLegend,
} from './FleetCalendarDriverLegend'
import { useEnsureFleetDriverNames } from './useFleetDriverDirectory'

export type { CalendarAssignment, CalendarTrip }

type AssignmentCalendarProps = {
  assignments: CalendarAssignment[]
  trips: CalendarTrip[]
  selectedTeamMemberId?: string | null
  selectedResourceId?: string | null
  tripsOnly?: boolean
  /** When true, trip cards omit the driver line (e.g. driver profile calendar). */
  omitDriverInTitle?: boolean
  /** When set, overrides default legend visibility (`!omitDriverInTitle`). */
  showDriverLegend?: boolean
  resolveDriverName: (teamMemberId: string) => string
  resolveResourceLabel: (resourceId: string) => string
  resolveResourceColor?: (resourceId: string) => string | null
  resourceColors?: Record<string, string>
  view: ScheduleViewMode
  range: ScheduleRange
  onRangeChange: (range: ScheduleRange) => void
  onViewChange: (view: ScheduleViewMode) => void
  onCreateTrip: (seed: TripCreateSeed) => void
}

export function AssignmentCalendar({
  assignments,
  trips,
  selectedTeamMemberId,
  selectedResourceId,
  tripsOnly = false,
  omitDriverInTitle = false,
  showDriverLegend,
  resolveDriverName,
  resolveResourceLabel,
  resolveResourceColor,
  resourceColors,
  view,
  range,
  onRangeChange,
  onViewChange,
  onCreateTrip,
}: AssignmentCalendarProps) {
  const t = useT()
  const { resolveTripTypeLabel } = useTaxiFleetLabels()
  const ensureDriverNames = useEnsureFleetDriverNames()
  const [selectedTripItem, setSelectedTripItem] = React.useState<ScheduleItem | null>(null)
  const [panelOpen, setPanelOpen] = React.useState(false)
  const [nameOverrides, setNameOverrides] = React.useState<Record<string, string>>({})

  const colorsKey = React.useMemo(
    () =>
      Object.entries(resourceColors ?? {})
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([id, color]) => `${id}:${color}`)
        .join('|'),
    [resourceColors],
  )

  const resolveColor = React.useCallback(
    (resourceId: string) => {
      const fromMap = resourceColors?.[resourceId]
      if (fromMap) return fromMap
      return resolveResourceColor?.(resourceId) ?? null
    },
    [resolveResourceColor, resourceColors],
  )

  const resolveDriverLabel = React.useCallback(
    (teamMemberId: string) => {
      const override = nameOverrides[teamMemberId]?.trim()
      if (override) return override
      return resolveDriverName(teamMemberId)
    },
    [nameOverrides, resolveDriverName],
  )

  const scheduleItems = React.useMemo(
    () =>
      buildFleetCalendarItems(
        tripsOnly ? [] : assignments,
        trips,
        {
          resolveDriverName: resolveDriverLabel,
          resolveResourceLabel,
          resolveTripTypeLabel,
          resolveUnscheduledDriverLabel: () => t('taxi_fleet.trips.unassigned', 'Unassigned'),
          resolveResourceColor: resolveColor,
        },
        selectedTeamMemberId,
        omitDriverInTitle ? { omitDriverInTitle: true } : undefined,
        selectedResourceId,
      ),
    // colorsKey forces rebuild when vehicle colors arrive asynchronously
    // eslint-disable-next-line react-hooks/exhaustive-deps -- colorsKey tracks resourceColors
    [
      assignments,
      colorsKey,
      omitDriverInTitle,
      resolveColor,
      resolveDriverLabel,
      resolveResourceLabel,
      resolveTripTypeLabel,
      selectedResourceId,
      selectedTeamMemberId,
      t,
      trips,
      tripsOnly,
    ],
  )

  const visibleDriverIdsKey = React.useMemo(() => {
    const ids = new Set<string>()
    for (const trip of trips) {
      if (trip.teamMemberId) ids.add(trip.teamMemberId)
    }
    if (!tripsOnly) {
      for (const assignment of assignments) {
        if (assignment.teamMemberId) ids.add(assignment.teamMemberId)
      }
    }
    if (selectedTeamMemberId) ids.add(selectedTeamMemberId)
    return [...ids].sort().join(',')
  }, [assignments, selectedTeamMemberId, trips, tripsOnly])

  React.useEffect(() => {
    const ids = visibleDriverIdsKey.split(',').filter(Boolean)
    if (!ids.length) return
    let cancelled = false
    void ensureDriverNames(ids).then((loaded) => {
      if (cancelled || !Object.keys(loaded).length) return
      setNameOverrides((current) => ({ ...current, ...loaded }))
    })
    return () => {
      cancelled = true
    }
  }, [ensureDriverNames, visibleDriverIdsKey])

  const handleItemClick = React.useCallback(
    (item: ScheduleItem) => {
      const metadata = item.metadata ?? {}
      if (metadata.recordType === 'trip' && typeof metadata.tripId === 'string') {
        setSelectedTripItem(item)
        setPanelOpen(true)
        return
      }
      if (metadata.recordType === 'assignment' && !tripsOnly) {
        onCreateTrip({
          teamMemberId: item.subjectId ?? null,
          resourceId: typeof metadata.resourceId === 'string' ? metadata.resourceId : null,
          assignmentId: typeof metadata.assignmentId === 'string' ? metadata.assignmentId : null,
          startedAt: item.startsAt,
          endedAt: item.endsAt,
        })
      }
    },
    [onCreateTrip, tripsOnly],
  )

  const handleSlotClick = React.useCallback(
    (slot: ScheduleSlot) => {
      onCreateTrip({ startedAt: slot.start, endedAt: slot.end })
    },
    [onCreateTrip],
  )

  const renderEvent = React.useCallback((item: ScheduleItem) => {
    if (item.metadata?.recordType === 'trip') {
      return <TripScheduleEventCard item={item} />
    }
    if (item.metadata?.recordType === 'assignment') {
      return <AssignmentScheduleEventCard item={item} />
    }
    return <span className="truncate text-xs font-medium">{item.title}</span>
  }, [])

  const driverLegendEntries = React.useMemo(
    () =>
      buildFleetCalendarDriverLegendEntries(
        scheduleItems,
        resolveDriverLabel,
        t('taxi_fleet.trips.unassigned', 'Unassigned'),
        t('taxi_fleet.calendar.unknownDriver', 'Unknown driver'),
      ),
    [resolveDriverLabel, scheduleItems, t],
  )

  const showDriverLegendBar =
    (showDriverLegend ?? !omitDriverInTitle) && driverLegendEntries.length > 0

  return (
    <div className="flex h-full min-h-0 max-h-full flex-1 flex-col gap-3 overflow-hidden">
      <ScheduleView
        className="min-h-0 flex-1"
        items={scheduleItems}
        view={view}
        range={range}
        onRangeChange={onRangeChange}
        onViewChange={onViewChange}
        onItemClick={handleItemClick}
        onSlotClick={handleSlotClick}
        showTimezone={false}
        renderEvent={renderEvent}
      />
      {showDriverLegendBar ? <FleetCalendarDriverLegend entries={driverLegendEntries} /> : null}
      <TripCalendarDetailsPanel
        open={panelOpen}
        item={selectedTripItem}
        onOpenChange={(open) => {
          setPanelOpen(open)
          if (!open) setSelectedTripItem(null)
        }}
      />
    </div>
  )
}
