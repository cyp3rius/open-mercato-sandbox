'use client'

import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { DriverShell } from '../../../components/driverApp/DriverShell'
import {
  driverBadgeNeutralClass,
  driverCardClass,
  driverMutedTextClass,
  driverPrimaryActionClass,
  driverSecondaryActionClass,
} from '../../../components/driverApp/driverUi'

type AssignmentRow = {
  id: string
  assignmentDate: string
  status: string
  resourceId: string
  resourceLabel?: string | null
  resourcePlate?: string | null
  plannedShiftStart?: string | null
  plannedShiftEnd?: string | null
  shiftStart?: string | null
  shiftEnd?: string | null
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

export default function DriverAssignmentsPage() {
  const t = useT()
  const [items, setItems] = React.useState<AssignmentRow[]>([])
  const [filter, setFilter] = React.useState<AssignmentFilter>('week')
  const [page, setPage] = React.useState(0)

  React.useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const { result } = await apiCall<{ items: AssignmentRow[] }>('/api/taxi_fleet/driver/assignments')
        if (!active) return
        setItems(sortAssignmentsNewestFirst(result?.items ?? []))
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

  return (
    <DriverShell title={t('taxi_fleet.driverApp.assignments.title', 'Assignments')}>
      <div className="space-y-3">

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
            {pageItems.map((row) => (
              <div key={row.id} className={driverCardClass}>
                <div className="flex items-start justify-between gap-3">
                  <div className="text-base font-semibold text-[#071437]">{row.assignmentDate}</div>
                  <span className={`${driverBadgeNeutralClass} shrink-0 capitalize`}>{row.status}</span>
                </div>
                {row.resourceLabel?.trim() ? (
                  <div className="mt-2 text-sm font-medium text-[#071437]">
                    {t('taxi_fleet.driverApp.vehicle', 'Vehicle')}: {row.resourceLabel.trim()}
                  </div>
                ) : row.resourcePlate?.trim() ? (
                  <div className="mt-2 text-sm font-medium text-[#071437]">
                    {t('taxi_fleet.driverApp.vehiclePlate', 'Plate')}: {row.resourcePlate.trim()}
                  </div>
                ) : null}
                <div className={`mt-2 ${driverMutedTextClass}`}>
                  {(row.plannedShiftStart ?? row.shiftStart)
                    ? new Date(row.plannedShiftStart ?? row.shiftStart!).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                  {(row.plannedShiftEnd ?? row.shiftEnd)
                    ? ` – ${new Date(row.plannedShiftEnd ?? row.shiftEnd!).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}`
                    : ''}
                </div>
              </div>
            ))}

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
