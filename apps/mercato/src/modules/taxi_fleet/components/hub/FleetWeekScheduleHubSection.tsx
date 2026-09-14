'use client'

import * as React from 'react'
import Link from 'next/link'
import { addDays, format } from 'date-fns'
import { ArrowRight } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { TAXI_FLEET_BASE } from '../../backend/taxi-fleet/paths'
import { useFleetDriverDirectory } from '../useFleetDriverDirectory'
import { useResourceLabels } from '../useResourceLabels'
import { useTaxiFleetLabels } from '../useTaxiFleetLabels'
import { buildFleetCalendarItems, type CalendarAssignment, type CalendarTrip } from '../../lib/calendarScheduleItems'

type AssignmentsResponse = { items: CalendarAssignment[] }
type TripsResponse = { items: CalendarTrip[] }

const FORWARD_DAYS = 14

export function FleetWeekScheduleHubSection() {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const { resolveName } = useFleetDriverDirectory()
  const { resolveTripTypeLabel } = useTaxiFleetLabels()
  const [assignments, setAssignments] = React.useState<CalendarAssignment[]>([])
  const [trips, setTrips] = React.useState<CalendarTrip[]>([])
  const [loading, setLoading] = React.useState(true)
  const [now, setNow] = React.useState(() => new Date())

  const range = React.useMemo(() => {
    const start = now
    const end = addDays(now, FORWARD_DAYS)
    return { start, end }
  }, [now])

  const resourceIds = React.useMemo(() => {
    const ids = new Set<string>()
    assignments.forEach((row) => row.resourceId && ids.add(row.resourceId))
    trips.forEach((row) => row.resourceId && ids.add(row.resourceId))
    return [...ids]
  }, [assignments, trips])
  const { resolveLabel: resolveResourceLabel, resolveColor: resolveResourceColor } = useResourceLabels(resourceIds)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const currentNow = new Date()
      setNow(currentNow)
      const dateFrom = format(currentNow, 'yyyy-MM-dd')
      const dateToEnd = addDays(currentNow, FORWARD_DAYS)
      const dateTo = format(dateToEnd, "yyyy-MM-dd'T'23:59:59")
      const assignmentParams = new URLSearchParams({
        page: '1',
        pageSize: '100',
        dateFrom,
        dateTo: format(dateToEnd, 'yyyy-MM-dd'),
      })
      const tripParams = new URLSearchParams({
        page: '1',
        pageSize: '100',
        dateFrom,
        dateTo,
      })
      const [assignmentCall, tripCall] = await Promise.all([
        apiCall<AssignmentsResponse>(`/api/taxi_fleet/assignments?${assignmentParams}`),
        apiCall<TripsResponse>(`/api/taxi_fleet/trips?${tripParams}`),
      ])
      if (cancelled) return
      setAssignments(Array.isArray(assignmentCall.result?.items) ? assignmentCall.result.items : [])
      setTrips(Array.isArray(tripCall.result?.items) ? tripCall.result.items : [])
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [scopeVersion])

  const upcomingItems = React.useMemo(() => {
    const items = buildFleetCalendarItems(
      assignments,
      trips,
      {
        resolveDriverName: resolveName,
        resolveResourceLabel,
        resolveTripTypeLabel,
        resolveUnscheduledDriverLabel: () => t('taxi_fleet.trips.unassigned', 'Unassigned'),
        resolveResourceColor,
      },
    )
    return items
      .filter((item) => item.startsAt >= now && item.startsAt <= range.end)
      .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime())
  }, [assignments, now, range.end, resolveName, resolveResourceColor, resolveResourceLabel, resolveTripTypeLabel, t, trips])

  const previewItems = upcomingItems.slice(0, 8)
  const assignmentCount = upcomingItems.filter((item) => item.metadata?.recordType === 'assignment').length
  const tripCount = upcomingItems.filter((item) => item.metadata?.recordType !== 'assignment').length

  return (
    <section className="rounded-lg border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">
            {t('taxi_fleet.hub.weekSchedule.title', 'Upcoming schedule')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'taxi_fleet.hub.weekSchedule.description',
              'Upcoming driver allocations and planned trips.',
            )}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {format(range.start, 'dd.MM')} – {format(range.end, 'dd.MM.yyyy')}
            {' · '}
            {t('taxi_fleet.hub.weekSchedule.counts', '{assignments} allocations, {trips} trips', {
              assignments: String(assignmentCount),
              trips: String(tripCount),
            })}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={`${TAXI_FLEET_BASE}/assignments`}>
            {t('taxi_fleet.hub.weekSchedule.openCalendar', 'Open planning')}
            <ArrowRight className="ml-1 size-4" aria-hidden />
          </Link>
        </Button>
      </div>
      <div className="mt-4 space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('taxi_fleet.hub.loading', 'Loading…')}</p>
        ) : previewItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('taxi_fleet.hub.weekSchedule.empty', 'Nothing upcoming in the next two weeks.')}
          </p>
        ) : (
          previewItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{item.title}</div>
                <div className="text-xs text-muted-foreground">
                  {format(item.startsAt, 'EEE dd.MM HH:mm')} – {format(item.endsAt, 'HH:mm')}
                </div>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {item.metadata?.recordType === 'assignment'
                  ? t('taxi_fleet.hub.weekSchedule.allocation', 'Allocation')
                  : t('taxi_fleet.hub.weekSchedule.trip', 'Trip')}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
