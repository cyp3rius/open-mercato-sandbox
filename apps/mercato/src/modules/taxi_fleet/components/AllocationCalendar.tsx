"use client"

import * as React from 'react'
import { endOfDay, endOfWeek, format, startOfWeek } from 'date-fns'
import { pl } from 'date-fns/locale/pl'
import {
  ScheduleView,
  type ScheduleItem,
  type ScheduleRange,
  type ScheduleSlot,
  type ScheduleViewMode,
} from '@open-mercato/ui/backend/schedule'
import {
  mapAssignmentsToScheduleItems,
  type CalendarAssignment,
} from '../lib/calendarScheduleItems'
import type { FleetCalendarLabelResolvers } from '../lib/calendarScheduleItems'
import { AssignmentScheduleEventCard } from './TripScheduleEventCard'

type AllocationCalendarProps = {
  assignments: CalendarAssignment[]
  resolvers: FleetCalendarLabelResolvers
  view: ScheduleViewMode
  range: ScheduleRange
  onRangeChange: (range: ScheduleRange) => void
  onViewChange: (view: ScheduleViewMode) => void
  onAssignmentClick: (assignment: CalendarAssignment) => void
  onSlotClick: (seed: { assignmentDate: string; shiftStart: Date; shiftEnd: Date }) => void
}

export function AllocationCalendar({
  assignments,
  resolvers,
  view,
  range,
  onRangeChange,
  onViewChange,
  onAssignmentClick,
  onSlotClick,
}: AllocationCalendarProps) {
  const scheduleItems = React.useMemo(
    () => mapAssignmentsToScheduleItems(assignments, resolvers),
    [assignments, resolvers],
  )

  const assignmentById = React.useMemo(() => {
    const map = new Map<string, CalendarAssignment>()
    assignments.forEach((row) => map.set(row.id, row))
    return map
  }, [assignments])

  const handleItemClick = React.useCallback(
    (item: ScheduleItem) => {
      const assignmentId = typeof item.metadata?.assignmentId === 'string' ? item.metadata.assignmentId : null
      if (!assignmentId) return
      const row = assignmentById.get(assignmentId)
      if (row) onAssignmentClick(row)
    },
    [assignmentById, onAssignmentClick],
  )

  const handleSlotClick = React.useCallback(
    (slot: ScheduleSlot) => {
      onSlotClick({
        assignmentDate: format(slot.start, 'yyyy-MM-dd'),
        shiftStart: slot.start,
        shiftEnd: slot.end,
      })
    },
    [onSlotClick],
  )

  return (
    <ScheduleView
      items={scheduleItems}
      view={view}
      range={range}
      onRangeChange={onRangeChange}
      onViewChange={onViewChange}
      onItemClick={handleItemClick}
      onSlotClick={handleSlotClick}
      showTimezone={false}
      viewModes={['week', 'month']}
      renderEvent={(item) => <AssignmentScheduleEventCard item={item} />}
    />
  )
}

export function createDefaultAllocationWeekRange(reference = new Date()): ScheduleRange {
  return {
    start: startOfWeek(reference, { locale: pl, weekStartsOn: 1 }),
    end: endOfWeek(reference, { locale: pl, weekStartsOn: 1 }),
  }
}

export function formatAllocationRangeQuery(range: ScheduleRange): { dateFrom: string; dateTo: string } {
  return {
    dateFrom: format(range.start, 'yyyy-MM-dd'),
    dateTo: format(endOfDay(range.end), 'yyyy-MM-dd'),
  }
}
