"use client"

import * as React from 'react'
import { endOfDay, endOfWeek, format, startOfWeek } from 'date-fns'
import { Plus } from 'lucide-react'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { FormHeader } from '@open-mercato/ui/backend/forms'
import { Button } from '@open-mercato/ui/primitives/button'
import { FilterBar, type FilterDef, type FilterValues } from '@open-mercato/ui/backend/FilterBar'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { ScheduleRange, ScheduleViewMode } from '@open-mercato/ui/backend/schedule'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { resolveScheduleDateFnsLocale } from '@open-mercato/ui/backend/schedule'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { TAXI_FLEET_BASE } from '../paths'
import {
  AssignmentCalendar,
  type CalendarTrip,
} from '../../../components/AssignmentCalendar'
import { useFleetDriverDirectory } from '../../../components/useFleetDriverDirectory'
import { useResourceLabels } from '../../../components/useResourceLabels'
import { useFleetBackendSession } from '../../../components/useFleetBackendSession'
import { useTaxiFleetSettings } from '../../../components/useTaxiFleetSettings'
import { TripCreateDialog, type TripCreateSeed } from '../../../components/TripCreateDialog'
import { remoteSearchFleetResources } from '../../../lib/fleetResourceSearch'
import { transformTripListItem } from '../../../lib/listItemFields'

type TripsResponse = { items: Record<string, unknown>[]; totalPages: number }

export default function TaxiFleetAssignmentsPage() {
  const t = useT()
  const appLocale = useLocale()
  const dateLocale = React.useMemo(() => resolveScheduleDateFnsLocale(appLocale), [appLocale])
  const scopeVersion = useOrganizationScopeVersion()
  const { profiles, resolveName } = useFleetDriverDirectory()
  const { isDriverOnly, lockedTeamMemberId } = useFleetBackendSession()
  const { resourceTypeId } = useTaxiFleetSettings()
  const [view, setView] = React.useState<ScheduleViewMode>('week')
  const [range, setRange] = React.useState<ScheduleRange>(() => {
    const locale = resolveScheduleDateFnsLocale(appLocale)
    const reference = new Date()
    return {
      start: startOfWeek(reference, { locale }),
      end: endOfWeek(reference, { locale }),
    }
  })
  const [filterValues, setFilterValues] = React.useState<FilterValues>({})
  const [trips, setTrips] = React.useState<CalendarTrip[]>([])
  const [reloadToken, setReloadToken] = React.useState(0)
  const [tripDialogOpen, setTripDialogOpen] = React.useState(false)
  const [tripSeed, setTripSeed] = React.useState<TripCreateSeed | null>(null)
  const [vehicleFilterOptions, setVehicleFilterOptions] = React.useState<Array<{ value: string; label: string }>>([])

  React.useEffect(() => {
    setRange((current) => {
      const start = startOfWeek(current.start, { locale: dateLocale })
      const end = endOfWeek(current.start, { locale: dateLocale })
      if (current.start.getTime() === start.getTime() && current.end.getTime() === end.getTime()) {
        return current
      }
      return { start, end }
    })
  }, [dateLocale])

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
    trips.forEach((row) => {
      if (row.resourceId) ids.add(row.resourceId)
    })
    if (selectedResourceId) ids.add(selectedResourceId)
    return [...ids]
  }, [selectedResourceId, trips])
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
      const tripParams = new URLSearchParams({
        page: '1',
        pageSize: '100',
        dateFrom,
        dateTo,
      })
      if (selectedTeamMemberId) {
        tripParams.set('teamMemberId', selectedTeamMemberId)
      }
      if (selectedResourceId) {
        tripParams.set('resourceId', selectedResourceId)
      }
      const tripCall = await apiCall<TripsResponse>(`/api/taxi_fleet/trips?${tripParams}`)
      if (cancelled) return
      const items = Array.isArray(tripCall.result?.items) ? tripCall.result.items : []
      setTrips(items.map((item) => transformTripListItem(item) as CalendarTrip))
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [range.end, range.start, scopeVersion, reloadToken, selectedResourceId, selectedTeamMemberId])

  return (
    <Page className="flex h-[calc(100svh-8rem)] max-h-[calc(100svh-8rem)] flex-col overflow-hidden !space-y-0">
      <PageBody className="flex min-h-0 flex-1 flex-col overflow-hidden !space-y-0">
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
          <div className="shrink-0 space-y-4">
            <FormHeader
              mode="detail"
              backHref={TAXI_FLEET_BASE}
              backLabel={t('taxi_fleet.hub.back', 'Back to dashboard')}
              entityTypeLabel={t('taxi_fleet.hub.dashboardTitle', 'Dashboard')}
              title={t('taxi_fleet.assignments.title', 'Course planning')}
              subtitle={t(
                'taxi_fleet.assignments.description',
                'Planned trips in weekly, monthly, and daily views.',
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
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <AssignmentCalendar
              assignments={[]}
              trips={trips}
              tripsOnly
              omitDriverInTitle
              showDriverLegend
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
