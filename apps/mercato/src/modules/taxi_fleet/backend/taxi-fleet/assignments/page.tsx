"use client"

import * as React from 'react'
import { endOfDay, endOfWeek, format, startOfWeek } from 'date-fns'
import { enUS } from 'date-fns/locale/en-US'
import { Plus } from 'lucide-react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { FormHeader } from '@open-mercato/ui/backend/forms'
import { Button } from '@open-mercato/ui/primitives/button'
import { FilterBar, type FilterDef, type FilterValues } from '@open-mercato/ui/backend/FilterBar'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { ScheduleRange, ScheduleViewMode } from '@open-mercato/ui/backend/schedule'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { TAXI_FLEET_BASE } from '../paths'
import {
  AssignmentCalendar,
  type CalendarAssignment,
  type CalendarTrip,
} from '../../../components/AssignmentCalendar'
import { useFleetDriverDirectory } from '../../../components/useFleetDriverDirectory'
import { useResourceLabels } from '../../../components/useResourceLabels'
import { useFleetBackendSession } from '../../../components/useFleetBackendSession'
import { useTaxiFleetSettings } from '../../../components/useTaxiFleetSettings'
import { TripCreateDialog, type TripCreateSeed } from '../../../components/TripCreateDialog'
import { remoteSearchFleetResources } from '../../../lib/fleetResourceSearch'

type AssignmentsResponse = { items: CalendarAssignment[]; totalPages: number }
type TripsResponse = { items: CalendarTrip[]; totalPages: number }

function createDefaultWeekRange(reference = new Date()): ScheduleRange {
  return {
    start: startOfWeek(reference, { locale: enUS }),
    end: endOfWeek(reference, { locale: enUS }),
  }
}

export default function TaxiFleetAssignmentsPage() {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const { profiles, resolveName } = useFleetDriverDirectory()
  const { isDriverOnly, lockedTeamMemberId } = useFleetBackendSession()
  const { resourceTypeId } = useTaxiFleetSettings()
  const [view, setView] = React.useState<ScheduleViewMode>('week')
  const [range, setRange] = React.useState<ScheduleRange>(() => createDefaultWeekRange())
  const [filterValues, setFilterValues] = React.useState<FilterValues>({})
  const [assignments, setAssignments] = React.useState<CalendarAssignment[]>([])
  const [trips, setTrips] = React.useState<CalendarTrip[]>([])
  const [reloadToken, setReloadToken] = React.useState(0)
  const [tripDialogOpen, setTripDialogOpen] = React.useState(false)
  const [tripSeed, setTripSeed] = React.useState<TripCreateSeed | null>(null)
  const [vehicleFilterOptions, setVehicleFilterOptions] = React.useState<Array<{ value: string; label: string }>>([])

  const selectedTeamMemberId = isDriverOnly
    ? lockedTeamMemberId
    : typeof filterValues.teamMemberId === 'string' && filterValues.teamMemberId.length > 0
      ? filterValues.teamMemberId
      : null

  const selectedResourceId =
    typeof filterValues.resourceId === 'string' && filterValues.resourceId.length > 0
      ? filterValues.resourceId
      : null

  const resourceIds = React.useMemo(() => {
    const ids = new Set<string>()
    assignments.forEach((row) => ids.add(row.resourceId))
    trips.forEach((row) => {
      if (row.resourceId) ids.add(row.resourceId)
    })
    if (selectedResourceId) ids.add(selectedResourceId)
    return [...ids]
  }, [assignments, selectedResourceId, trips])
  const { resolveLabel: resolveResourceLabel, resolveColor: resolveResourceColor, colors: resourceColors } = useResourceLabels(resourceIds)

  const reloadCalendarData = React.useCallback(() => {
    setReloadToken((value) => value + 1)
  }, [])

  const openCreateTrip = React.useCallback((seed: TripCreateSeed) => {
    setTripSeed(seed)
    setTripDialogOpen(true)
  }, [])

  const driverFilterOptions = React.useMemo(
    () =>
      profiles.map((profile) => ({
        value: profile.teamMemberId,
        label: resolveName(profile.teamMemberId),
      })),
    [profiles, resolveName],
  )

  React.useEffect(() => {
    let cancelled = false
    async function loadVehicleOptions() {
      const rows = await remoteSearchFleetResources('', resourceTypeId)
      if (cancelled) return
      setVehicleFilterOptions(rows.map((row) => ({ value: row.value, label: row.label })))
    }
    void loadVehicleOptions()
    return () => {
      cancelled = true
    }
  }, [resourceTypeId, scopeVersion])

  const filters = React.useMemo<FilterDef[]>(
    () => [
      {
        id: 'teamMemberId',
        label: t('taxi_fleet.assignments.driver', 'Driver'),
        type: 'combobox',
        options: driverFilterOptions,
        formatValue: (id) => resolveName(id),
        loadOptions: async (query) => {
          const normalized = query?.trim().toLowerCase() ?? ''
          if (!normalized) return driverFilterOptions
          return driverFilterOptions.filter((option) => option.label.toLowerCase().includes(normalized))
        },
        placeholder: t('taxi_fleet.assignments.filterDriver', 'Select driver…'),
      },
      {
        id: 'resourceId',
        label: t('taxi_fleet.assignments.vehicle', 'Vehicle'),
        type: 'combobox',
        options: vehicleFilterOptions,
        formatValue: (id) => resolveResourceLabel(id),
        loadOptions: async (query) => {
          const rows = await remoteSearchFleetResources(query, resourceTypeId)
          return rows.map((row) => ({ value: row.value, label: row.label }))
        },
        placeholder: t('taxi_fleet.assignments.filterVehicle', 'Select vehicle…'),
      },
    ],
    [driverFilterOptions, resolveName, resolveResourceLabel, resourceTypeId, t, vehicleFilterOptions],
  )

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      const dateFrom = format(range.start, 'yyyy-MM-dd')
      const dateTo = format(endOfDay(range.end), "yyyy-MM-dd'T'HH:mm:ss")
      const assignmentParams = new URLSearchParams({
        page: '1',
        pageSize: '100',
        dateFrom,
        dateTo: format(range.end, 'yyyy-MM-dd'),
      })
      const tripParams = new URLSearchParams({
        page: '1',
        pageSize: '100',
        dateFrom,
        dateTo,
      })
      if (selectedTeamMemberId) {
        assignmentParams.set('teamMemberId', selectedTeamMemberId)
        tripParams.set('teamMemberId', selectedTeamMemberId)
      }
      if (selectedResourceId) {
        assignmentParams.set('resourceId', selectedResourceId)
        tripParams.set('resourceId', selectedResourceId)
      }
      const [assignmentCall, tripCall] = await Promise.all([
        apiCall<AssignmentsResponse>(`/api/taxi_fleet/assignments?${assignmentParams}`),
        apiCall<TripsResponse>(`/api/taxi_fleet/trips?${tripParams}`),
      ])
      if (cancelled) return
      setAssignments(Array.isArray(assignmentCall.result?.items) ? assignmentCall.result.items : [])
      setTrips(Array.isArray(tripCall.result?.items) ? tripCall.result.items : [])
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [range.end, range.start, scopeVersion, reloadToken, selectedResourceId, selectedTeamMemberId])

  return (
    <Page>
      <PageBody>
        <div className="space-y-4">
          <FormHeader
            mode="detail"
            backHref={TAXI_FLEET_BASE}
            backLabel={t('taxi_fleet.hub.back', 'Back to dashboard')}
            entityTypeLabel={t('taxi_fleet.hub.dashboardTitle', 'Dashboard')}
            title={t('taxi_fleet.assignments.title', 'Course planning')}
            subtitle={t(
              'taxi_fleet.assignments.description',
              'Driver and vehicle assignments plus planned trips in weekly, monthly, and daily views.',
            )}
            utilityActions={(
              <Button
                type="button"
                size="sm"
                className="inline-flex items-center gap-2"
                onClick={() => openCreateTrip({})}
              >
                <Plus className="size-4 shrink-0" aria-hidden />
                {t('taxi_fleet.trips.actions.new', 'New trip')}
              </Button>
            )}
          />
          <FilterBar
            filters={isDriverOnly ? [] : filters}
            values={filterValues}
            onApply={setFilterValues}
            onClear={() => setFilterValues({})}
          />
          <AssignmentCalendar
            assignments={assignments}
            trips={trips}
            selectedTeamMemberId={selectedTeamMemberId}
            selectedResourceId={selectedResourceId}
            resolveDriverName={resolveName}
            resolveResourceLabel={resolveResourceLabel}
            resolveResourceColor={resolveResourceColor}
            resourceColors={resourceColors}
            view={view}
            range={range}
            onRangeChange={setRange}
            onViewChange={setView}
            onCreateTrip={openCreateTrip}
          />
        </div>
        <TripCreateDialog
          open={tripDialogOpen}
          onOpenChange={setTripDialogOpen}
          seed={tripSeed}
          driverProfiles={profiles}
          resolveDriverName={resolveName}
          lockedTeamMemberId={lockedTeamMemberId}
          onCreated={reloadCalendarData}
        />
      </PageBody>
    </Page>
  )
}
