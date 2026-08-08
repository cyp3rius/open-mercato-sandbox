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
import { TripScheduleEventCard } from './TripScheduleEventCard'
import { TripCalendarDetailsPanel } from './TripCalendarDetailsPanel'

export type { CalendarAssignment, CalendarTrip }

type AssignmentCalendarProps = {
  assignments: CalendarAssignment[]
  trips: CalendarTrip[]
  selectedTeamMemberId?: string | null
  selectedResourceId?: string | null
  tripsOnly?: boolean
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
  const [selectedTripItem, setSelectedTripItem] = React.useState<ScheduleItem | null>(null)
  const [panelOpen, setPanelOpen] = React.useState(false)

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

  const scheduleItems = React.useMemo(
    () =>
      buildFleetCalendarItems(
        tripsOnly ? [] : assignments,
        trips,
        {
          resolveDriverName,
          resolveResourceLabel,
          resolveTripTypeLabel,
          resolveUnscheduledDriverLabel: () => t('taxi_fleet.trips.unassigned', 'Unassigned'),
          resolveResourceColor: resolveColor,
        },
        selectedTeamMemberId,
        tripsOnly ? { omitDriverInTitle: true } : undefined,
        selectedResourceId,
      ),
    // colorsKey forces rebuild when vehicle colors arrive asynchronously
    // eslint-disable-next-line react-hooks/exhaustive-deps -- colorsKey tracks resourceColors
    [
      assignments,
      colorsKey,
      resolveColor,
      resolveDriverName,
      resolveResourceLabel,
      resolveTripTypeLabel,
      selectedResourceId,
      selectedTeamMemberId,
      t,
      trips,
      tripsOnly,
    ],
  )

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
    return <span className="truncate text-xs font-medium">{item.title}</span>
  }, [])

  return (
    <>
      <ScheduleView
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
      <TripCalendarDetailsPanel
        open={panelOpen}
        item={selectedTripItem}
        onOpenChange={(open) => {
          setPanelOpen(open)
          if (!open) setSelectedTripItem(null)
        }}
      />
    </>
  )
}
