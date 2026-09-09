'use client'

import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { DriverShell } from '../../../components/driverApp/DriverShell'
import {
  DriverShiftVehiclePicker,
  buildShiftVehicleOptions,
  useShiftVehicleSelection,
  type DriverDefaultVehicleOption,
} from '../../../components/driverApp/DriverShiftVehiclePicker'
import {
  driverBadgeNeutralClass,
  driverBadgeSuccessClass,
  driverCardClass,
  driverMutedTextClass,
  driverPrimaryActionClass,
  driverSecondaryActionClass,
  driverSectionDescClass,
  driverSectionTitleClass,
} from '../../../components/driverApp/driverUi'
import { enqueueDriverMutation } from '../../../lib/driverOffline/outbox'
import { formatVehicleResourceLabel, stripPlateFromVehicleName } from '../../../lib/vehicleResourceLabel'

type AssignmentRow = {
  id: string
  assignmentDate: string
  status: string
  resourceId: string
  resourceLabel?: string | null
  resourceName?: string | null
  resourcePlate?: string | null
  plannedShiftStart?: string | null
  plannedShiftEnd?: string | null
  shiftStart?: string | null
  shiftEnd?: string | null
}

type MeResponse = {
  today?: string
  profile: { defaultResourceIds?: DriverDefaultVehicleOption[] } | null
  todayAssignment: AssignmentRow | null
}

type AssignmentFilter = 'all' | 'week'

const PAGE_SIZE = 10

function parseAssignmentDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) {
    const fallback = new Date(value)
    return Number.isNaN(fallback.getTime()) ? null : fallback
  }
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  return new Date(year, month, day)
}

function startOfLocalWeek(date = new Date()): Date {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const weekday = day.getDay()
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday
  day.setDate(day.getDate() + mondayOffset)
  return day
}

function endOfLocalWeek(date = new Date()): Date {
  const start = startOfLocalWeek(date)
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999)
}

function isAssignmentInCurrentWeek(row: AssignmentRow, day = new Date()): boolean {
  const assignmentDay = parseAssignmentDate(row.assignmentDate)
  if (!assignmentDay) return false
  const start = startOfLocalWeek(day).getTime()
  const end = endOfLocalWeek(day).getTime()
  const time = assignmentDay.getTime()
  return time >= start && time <= end
}

function assignmentSortTime(row: AssignmentRow): number {
  const startRaw = row.plannedShiftStart ?? row.shiftStart
  if (startRaw) {
    const shift = new Date(startRaw).getTime()
    if (!Number.isNaN(shift)) return shift
  }
  const day = parseAssignmentDate(row.assignmentDate)
  return day ? day.getTime() : 0
}

function sortAssignmentsNewestFirst(items: AssignmentRow[]): AssignmentRow[] {
  return [...items].sort((left, right) => assignmentSortTime(right) - assignmentSortTime(left))
}

function formatClock(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function vehicleLine(row: AssignmentRow, t: (key: string, fallback: string) => string) {
  const plate = row.resourcePlate?.trim() || null
  const name =
    stripPlateFromVehicleName(row.resourceName || row.resourceLabel, plate) || null
  const singleLine = formatVehicleResourceLabel(name, plate)
  if (!singleLine) return null
  return (
    <div className="mt-2 text-sm font-medium text-[#071437]">
      {name && plate ? (
        <>
          <div>
            {t('taxi_fleet.driverApp.vehicle', 'Vehicle')}: {name}
          </div>
          <div className="text-xs font-medium text-[#4B5675]">
            {t('taxi_fleet.driverApp.vehiclePlate', 'Plate')}: {plate}
          </div>
        </>
      ) : (
        <div>
          {t('taxi_fleet.driverApp.vehicle', 'Vehicle')}: {singleLine}
        </div>
      )}
    </div>
  )
}

function TodayShiftStartCard({
  todayAssignment,
  defaults,
  busy,
  onStartPlanned,
  onStartAdHoc,
}: {
  todayAssignment: AssignmentRow | null
  defaults: DriverDefaultVehicleOption[]
  busy: boolean
  onStartPlanned: (assignmentId: string, resourceId: string) => void
  onStartAdHoc: (resourceId: string) => void
}) {
  const t = useT()
  const canStartPlanned = Boolean(todayAssignment && !todayAssignment.shiftStart)
  const canStartAdHoc = !todayAssignment || Boolean(todayAssignment.shiftEnd)
  const shiftVehicles = React.useMemo(
    () =>
      buildShiftVehicleOptions({
        defaults,
        // Only seed planned unstarted assignment vehicle; ended → fresh ad-hoc pick.
        assignment:
          canStartPlanned && todayAssignment
            ? {
                resourceId: todayAssignment.resourceId,
                resourceLabel: todayAssignment.resourceLabel,
                resourceName: todayAssignment.resourceName,
                resourcePlate: todayAssignment.resourcePlate,
              }
            : null,
      }),
    [canStartPlanned, defaults, todayAssignment],
  )
  const { selectedResourceId, setSelectedResourceId, needsVehiclePick } = useShiftVehicleSelection(
    shiftVehicles,
    todayAssignment?.resourceId,
  )

  if (!canStartPlanned && !canStartAdHoc) return null
  if (!needsVehiclePick && canStartAdHoc) {
    const hasDefaultsButNoneFree = defaults.length > 0
    return (
      <div className={driverCardClass}>
        <div className={driverSectionTitleClass}>
          {t('taxi_fleet.driverApp.home.noAssignment', 'No assignment today')}
        </div>
        <p className={driverSectionDescClass}>
          {hasDefaultsButNoneFree
            ? t(
                'taxi_fleet.driverApp.home.noAvailableVehicles',
                'All your default vehicles are already assigned for today.',
              )
            : t(
                'taxi_fleet.driverApp.home.noAssignmentHint',
                'Ask dispatch to assign a vehicle for today, or set default vehicles on your profile.',
              )}
        </p>
      </div>
    )
  }
  if (!needsVehiclePick) {
    if (canStartPlanned && defaults.length > 0) {
      return (
        <div className={driverCardClass}>
          <div className={driverSectionTitleClass}>
            {t('taxi_fleet.driverApp.home.todayShift', 'Today’s shift')}
          </div>
          <p className={driverSectionDescClass}>
            {t(
              'taxi_fleet.driverApp.home.noAvailableVehicles',
              'All your default vehicles are already assigned for today.',
            )}
          </p>
        </div>
      )
    }
    return null
  }
  return (
    <div className={`${driverCardClass} space-y-3`}>
      <div className={driverSectionTitleClass}>
        {canStartPlanned
          ? t('taxi_fleet.driverApp.home.todayShift', 'Today’s shift')
          : t('taxi_fleet.driverApp.home.clockInAdHoc', 'Start ad-hoc shift')}
      </div>
      <p className={driverSectionDescClass}>
        {canStartPlanned
          ? t(
              'taxi_fleet.driverApp.shift.selectVehicle',
              'Confirm vehicle for this shift',
            )
          : t(
              'taxi_fleet.driverApp.home.adHocHint',
              'No planned shift for today. Pick a default vehicle to start an ad-hoc shift.',
            )}
      </p>
      <DriverShiftVehiclePicker
        vehicles={shiftVehicles}
        assignmentResourceId={todayAssignment?.resourceId}
        value={selectedResourceId}
        onChange={setSelectedResourceId}
        disabled={busy}
      />
      <Button
        type="button"
        className={driverPrimaryActionClass}
        disabled={busy || !selectedResourceId}
        onClick={() => {
          if (!selectedResourceId) return
          if (canStartPlanned && todayAssignment) {
            onStartPlanned(todayAssignment.id, selectedResourceId)
            return
          }
          onStartAdHoc(selectedResourceId)
        }}
      >
        {busy
          ? t('taxi_fleet.driverApp.home.starting', 'Starting…')
          : canStartPlanned
            ? t('taxi_fleet.driverApp.home.clockIn', 'Start shift')
            : t('taxi_fleet.driverApp.home.clockInAdHoc', 'Start ad-hoc shift')}
      </Button>
    </div>
  )
}

export default function DriverAssignmentsPage() {
  const t = useT()
  const [items, setItems] = React.useState<AssignmentRow[]>([])
  const [me, setMe] = React.useState<MeResponse | null>(null)
  const [filter, setFilter] = React.useState<AssignmentFilter>('week')
  const [page, setPage] = React.useState(0)
  const [busyId, setBusyId] = React.useState<string | null>(null)

  const reload = React.useCallback(async () => {
    const [assignmentsCall, meCall] = await Promise.all([
      apiCall<{ items: AssignmentRow[] }>('/api/taxi_fleet/driver/assignments'),
      apiCall<MeResponse>('/api/taxi_fleet/driver/me'),
    ])
    setItems(sortAssignmentsNewestFirst(assignmentsCall.result?.items ?? []))
    setMe(meCall.result ?? null)
  }, [])

  React.useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [assignmentsCall, meCall] = await Promise.all([
          apiCall<{ items: AssignmentRow[] }>('/api/taxi_fleet/driver/assignments'),
          apiCall<MeResponse>('/api/taxi_fleet/driver/me'),
        ])
        if (!active) return
        setItems(sortAssignmentsNewestFirst(assignmentsCall.result?.items ?? []))
        setMe(meCall.result ?? null)
      } catch {
        flash(t('taxi_fleet.driverApp.assignments.loadFailed', 'Could not load assignments.'), 'error')
      }
    })()
    return () => {
      active = false
    }
  }, [t])

  const filteredItems = React.useMemo(() => {
    const scoped = filter === 'week' ? items.filter((row) => isAssignmentInCurrentWeek(row)) : items
    return sortAssignmentsNewestFirst(scoped)
  }, [filter, items])

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const pageItems = filteredItems.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)
  const canGoPrev = safePage > 0
  const canGoNext = safePage < pageCount - 1 && filteredItems.length > 0

  React.useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  function selectFilter(next: AssignmentFilter) {
    setFilter(next)
    setPage(0)
  }

  async function endShift(row: AssignmentRow) {
    if (row.status === 'cancelled') return
    setBusyId(row.id)
    try {
      if (!navigator.onLine) {
        await enqueueDriverMutation({
          type: 'assignment.shift',
          payload: { assignmentId: row.id, action: 'end' },
        })
        setItems((current) =>
          current.map((item) =>
            item.id !== row.id
              ? item
              : {
                  ...item,
                  shiftEnd: new Date().toISOString(),
                  status: 'completed',
                },
          ),
        )
        flash(t('taxi_fleet.driverApp.assignments.shiftEnded', 'Shift ended.'), 'success')
        return
      }
      await apiCall(`/api/taxi_fleet/driver/assignments/${row.id}/shift`, {
        method: 'POST',
        body: JSON.stringify({ action: 'end' }),
      })
      await reload()
      flash(t('taxi_fleet.driverApp.assignments.shiftEnded', 'Shift ended.'), 'success')
    } catch {
      flash(t('taxi_fleet.driverApp.home.shiftFailed', 'Could not update shift.'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function startPlanned(assignmentId: string, resourceId: string) {
    setBusyId(assignmentId)
    try {
      if (!navigator.onLine) {
        await enqueueDriverMutation({
          type: 'assignment.shift',
          payload: { assignmentId, action: 'start', resourceId },
        })
        await reload()
        flash(t('taxi_fleet.driverApp.assignments.shiftStarted', 'Shift started.'), 'success')
        return
      }
      await apiCall(`/api/taxi_fleet/driver/assignments/${assignmentId}/shift`, {
        method: 'POST',
        body: JSON.stringify({ action: 'start', resourceId }),
      })
      await reload()
      flash(t('taxi_fleet.driverApp.assignments.shiftStarted', 'Shift started.'), 'success')
    } catch {
      flash(t('taxi_fleet.driverApp.home.shiftFailed', 'Could not update shift.'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function startAdHoc(resourceId: string) {
    setBusyId('adhoc')
    try {
      if (!navigator.onLine) {
        await enqueueDriverMutation({
          type: 'assignment.self_start',
          payload: { resourceId },
        })
        await reload()
        flash(t('taxi_fleet.driverApp.assignments.shiftStarted', 'Shift started.'), 'success')
        return
      }
      await apiCall('/api/taxi_fleet/driver/assignments/start', {
        method: 'POST',
        body: JSON.stringify({ resourceId }),
      })
      await reload()
      flash(t('taxi_fleet.driverApp.assignments.shiftStarted', 'Shift started.'), 'success')
    } catch {
      flash(t('taxi_fleet.driverApp.home.shiftFailed', 'Could not update shift.'), 'error')
    } finally {
      setBusyId(null)
    }
  }

  const todayAssignment = me?.todayAssignment ?? null
  const defaults = me?.profile?.defaultResourceIds ?? []
  const startBusy = busyId === 'adhoc' || (todayAssignment != null && busyId === todayAssignment.id)

  return (
    <DriverShell title={t('taxi_fleet.driverApp.assignments.title', 'Assignments')}>
      <div className="space-y-3">
        <TodayShiftStartCard
          todayAssignment={todayAssignment}
          defaults={defaults}
          busy={startBusy}
          onStartPlanned={(id, resourceId) => void startPlanned(id, resourceId)}
          onStartAdHoc={(resourceId) => void startAdHoc(resourceId)}
        />

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            className={
              filter === 'all'
                ? driverPrimaryActionClass
                : `${driverSecondaryActionClass} bg-white`
            }
            onClick={() => selectFilter('all')}
          >
            {t('taxi_fleet.driverApp.assignments.filterAll', 'All')}
          </Button>
          <Button
            type="button"
            className={
              filter === 'week'
                ? driverPrimaryActionClass
                : `${driverSecondaryActionClass} bg-white`
            }
            onClick={() => selectFilter('week')}
          >
            {t('taxi_fleet.driverApp.assignments.filterWeek', 'This week')}
          </Button>
        </div>

        {filteredItems.length === 0 ? (
          <div className={`px-1 py-8 text-center ${driverMutedTextClass}`}>
            {filter === 'week'
              ? t('taxi_fleet.driverApp.assignments.emptyWeek', 'No assignments this week.')
              : t('taxi_fleet.driverApp.assignments.empty', 'No assignments in range.')}
          </div>
        ) : (
          <>
            {pageItems.map((row) => {
              const canEnd = row.status !== 'cancelled' && Boolean(row.shiftStart) && !row.shiftEnd
              const onShift = Boolean(row.shiftStart) && !row.shiftEnd
              const busy = busyId === row.id
              return (
                <div key={row.id} className={driverCardClass}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-base font-semibold text-[#071437]">{row.assignmentDate}</div>
                    <span
                      className={`${onShift ? driverBadgeSuccessClass : driverBadgeNeutralClass} shrink-0 capitalize`}
                    >
                      {onShift
                        ? t('taxi_fleet.driverApp.onShift', 'On shift')
                        : row.status}
                    </span>
                  </div>
                  {vehicleLine(row, t)}
                  <div className={`mt-2 ${driverMutedTextClass}`}>
                    {t('taxi_fleet.driverApp.assignments.planned', 'Planned')}:{' '}
                    {formatClock(row.plannedShiftStart ?? null)}
                    {row.plannedShiftEnd ? ` – ${formatClock(row.plannedShiftEnd)}` : ''}
                  </div>
                  {row.shiftStart ? (
                    <div className={`mt-1 ${driverMutedTextClass}`}>
                      {t('taxi_fleet.driverApp.home.started', 'Started')}: {formatClock(row.shiftStart)}
                      {row.shiftEnd
                        ? ` · ${t('taxi_fleet.driverApp.home.ended', 'Ended')}: ${formatClock(row.shiftEnd)}`
                        : ''}
                    </div>
                  ) : null}
                  {canEnd ? (
                    <div className="mt-3">
                      <Button
                        type="button"
                        className={driverPrimaryActionClass}
                        disabled={busy}
                        onClick={() => void endShift(row)}
                      >
                        {busy
                          ? t('taxi_fleet.driverApp.trips.saving', 'Saving…')
                          : t('taxi_fleet.driverApp.home.clockOut', 'End shift')}
                      </Button>
                    </div>
                  ) : null}
                </div>
              )
            })}

            {pageCount > 1 ? (
              <div className="flex items-center justify-between gap-3 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={!canGoPrev}
                  className="h-10 gap-1 px-2 text-[#78829D] hover:!bg-[#F1F1F4]/50 hover:!text-[#4B5675] disabled:opacity-40"
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  aria-label={t('taxi_fleet.driverApp.assignments.pagePrev', 'Previous')}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  {t('taxi_fleet.driverApp.assignments.pagePrev', 'Previous')}
                </Button>

                <div className="flex items-center gap-1.5" aria-hidden>
                  {Array.from({ length: pageCount }, (_, index) => (
                    <span
                      key={`dot-${index}`}
                      className={`size-1.5 rounded-full ${
                        index === safePage ? 'bg-[#1B84FF]' : 'bg-[#DBDFE9]'
                      }`}
                    />
                  ))}
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  disabled={!canGoNext}
                  className="h-10 gap-1 px-2 text-[#78829D] hover:!bg-[#F1F1F4]/50 hover:!text-[#4B5675] disabled:opacity-40"
                  onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
                  aria-label={t('taxi_fleet.driverApp.assignments.pageNext', 'Next')}
                >
                  {t('taxi_fleet.driverApp.assignments.pageNext', 'Next')}
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </DriverShell>
  )
}
