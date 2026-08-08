"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { endOfDay, format } from 'date-fns'
import { Plus } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { ScheduleCalendarListPanel } from '@open-mercato/ui/backend/schedule'
import type { SchedulePresentationMode, ScheduleRange, ScheduleViewMode } from '@open-mercato/ui/backend/schedule'
import { Button } from '@open-mercato/ui/primitives/button'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { TAXI_FLEET_BASE } from '../../backend/taxi-fleet/paths'
import {
  AssignmentCalendar,
  type CalendarTrip,
} from '../AssignmentCalendar'
import { createDefaultAllocationWeekRange } from '../AllocationCalendar'
import { TripCreateDialog, type TripCreateSeed } from '../TripCreateDialog'
import type { FleetDriverProfile } from '../useFleetDriverDirectory'
import { useTaxiFleetLabels } from '../useTaxiFleetLabels'
import { useResourceLabels } from '../useResourceLabels'
import { TripCustomerPreview } from '../TripCustomerPreview'

type TripsResponse = { items: CalendarTrip[] }

type DriverTripsTabProps = {
  teamMemberId: string
  defaultResourceId?: string | null
  driverProfiles: FleetDriverProfile[]
  resolveDriverName: (teamMemberId: string) => string
  resolveResourceLabel: (resourceId: string) => string
  canManageTrips: boolean
}

export function DriverTripsTab({
  teamMemberId,
  defaultResourceId,
  driverProfiles,
  resolveDriverName,
  resolveResourceLabel,
  canManageTrips,
}: DriverTripsTabProps) {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()
  const { resolveTripTypeLabel, resolveTripStatusLabel } = useTaxiFleetLabels()
  const [presentation, setPresentation] = React.useState<SchedulePresentationMode>('calendar')
  const [view, setView] = React.useState<ScheduleViewMode>('week')
  const [range, setRange] = React.useState<ScheduleRange>(() => createDefaultAllocationWeekRange())
  const [trips, setTrips] = React.useState<CalendarTrip[]>([])
  const [reloadToken, setReloadToken] = React.useState(0)
  const [tripDialogOpen, setTripDialogOpen] = React.useState(false)
  const [tripSeed, setTripSeed] = React.useState<TripCreateSeed | null>(null)

  const resourceIds = React.useMemo(
    () => [...new Set(trips.map((trip) => trip.resourceId).filter((id): id is string => Boolean(id)))],
    [trips],
  )
  const { resolveColor: resolveResourceColor, colors: resourceColors } = useResourceLabels(resourceIds)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      const dateFrom = format(range.start, 'yyyy-MM-dd')
      const dateTo = format(endOfDay(range.end), "yyyy-MM-dd'T'HH:mm:ss")
      const tripParams = new URLSearchParams({
        page: '1',
        pageSize: '100',
        dateFrom,
        dateTo,
        teamMemberId,
      })
      const tripCall = await apiCall<TripsResponse>(`/api/taxi_fleet/trips?${tripParams}`)
      if (cancelled) return
      setTrips(Array.isArray(tripCall.result?.items) ? tripCall.result.items : [])
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [range.end, range.start, reloadToken, scopeVersion, teamMemberId])

  const openCreateTrip = React.useCallback((seed: TripCreateSeed = {}) => {
    setTripSeed({ ...seed, teamMemberId })
    setTripDialogOpen(true)
  }, [teamMemberId])

  const detailHref = (id: string) => `${TAXI_FLEET_BASE}/trips/${encodeURIComponent(id)}`

  const columns = React.useMemo<ColumnDef<CalendarTrip>[]>(
    () => [
      {
        accessorKey: 'startedAt',
        header: t('taxi_fleet.trips.startedAt', 'Started'),
        cell: ({ row }) => row.original.startedAt ?? '—',
      },
      {
        accessorKey: 'tripType',
        header: t('taxi_fleet.trips.type', 'Type'),
        cell: ({ row }) => resolveTripTypeLabel(row.original.tripType),
      },
      {
        accessorKey: 'status',
        header: t('taxi_fleet.trips.status', 'Status'),
        cell: ({ row }) => (
          <Badge variant="outline">{resolveTripStatusLabel(row.original.status)}</Badge>
        ),
      },
      {
        id: 'customer',
        header: t('taxi_fleet.trips.customer', 'Customer'),
        cell: ({ row }) => (
          <TripCustomerPreview
            customerPersonId={row.original.customerPersonId}
            customerCompanyId={row.original.customerCompanyId}
          />
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Link href={detailHref(row.original.id)} className="text-sm text-primary hover:underline">
            {t('taxi_fleet.trips.list.actions.viewDetails', 'View details')}
          </Link>
        ),
      },
    ],
    [resolveTripStatusLabel, resolveTripTypeLabel, t],
  )

  return (
    <>
      <ScheduleCalendarListPanel
        mode={presentation}
        onModeChange={setPresentation}
        listLabel={t('taxi_fleet.drivers.tabs.trips.listView', 'List view')}
        calendarLabel={t('taxi_fleet.drivers.tabs.trips.calendarView', 'Calendar view')}
        headerActions={
          canManageTrips ? (
            <Button type="button" size="sm" className="inline-flex items-center gap-2" onClick={() => openCreateTrip({})}>
              <Plus className="size-4 shrink-0" aria-hidden />
              {t('taxi_fleet.trips.actions.new', 'New trip')}
            </Button>
          ) : null
        }
        calendarContent={(
          <AssignmentCalendar
            assignments={[]}
            trips={trips}
            tripsOnly
            selectedTeamMemberId={teamMemberId}
            resolveDriverName={resolveDriverName}
            resolveResourceLabel={resolveResourceLabel}
            resolveResourceColor={resolveResourceColor}
            resourceColors={resourceColors}
            view={view}
            range={range}
            onRangeChange={setRange}
            onViewChange={setView}
            onCreateTrip={openCreateTrip}
          />
        )}
        listContent={(
          <DataTable<CalendarTrip>
            embedded
            data={trips}
            columns={columns}
            isLoading={false}
            emptyState={t('taxi_fleet.drivers.tabs.trips.empty', 'No trips for this driver in the selected period.')}
            onRowClick={(row) => router.push(detailHref(row.id))}
          />
        )}
      />
      <TripCreateDialog
        open={tripDialogOpen}
        onOpenChange={setTripDialogOpen}
        seed={tripSeed}
        driverProfiles={driverProfiles}
        resolveDriverName={resolveDriverName}
        lockedTeamMemberId={teamMemberId}
        defaultResourceId={defaultResourceId}
        onCreated={() => setReloadToken((value) => value + 1)}
      />
    </>
  )
}
