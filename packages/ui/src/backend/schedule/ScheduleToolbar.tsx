'use client'

import * as React from 'react'
import { Button } from '../../primitives/button'
import { Input } from '../../primitives/input'
import type { ScheduleRange, ScheduleViewMode } from './types'
import { cn } from '@open-mercato/shared/lib/utils'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { addDays, addMonths, addWeeks, differenceInCalendarDays, endOfDay, endOfMonth, endOfWeek, format, startOfDay, startOfMonth, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { resolveScheduleDateFnsLocale } from './dateLocale'

const VIEW_OPTIONS: Array<{ id: ScheduleViewMode; labelKey: string; fallback: string }> = [
  { id: 'day', labelKey: 'schedule.view.day', fallback: 'Day' },
  { id: 'week', labelKey: 'schedule.view.week', fallback: 'Week' },
  { id: 'month', labelKey: 'schedule.view.month', fallback: 'Month' },
  { id: 'agenda', labelKey: 'schedule.view.agenda', fallback: 'Agenda' },
]

function formatDateInputValue(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateInputValue(value: string, fallback: Date): Date {
  if (!value) return fallback
  const next = new Date(`${value}T00:00:00`)
  return Number.isNaN(next.getTime()) ? fallback : next
}

export type ScheduleToolbarProps = {
  view: ScheduleViewMode
  range: ScheduleRange
  timezone?: string
  onViewChange: (view: ScheduleViewMode) => void
  onRangeChange: (range: ScheduleRange) => void
  onTimezoneChange?: (timezone: string) => void
  showTimezone?: boolean
  viewModes?: ScheduleViewMode[]
  className?: string
}

export function ScheduleToolbar({
  view,
  range,
  timezone,
  onViewChange,
  onRangeChange,
  onTimezoneChange,
  showTimezone = true,
  viewModes,
  className,
}: ScheduleToolbarProps) {
  const t = useT()
  const appLocale = useLocale()
  const dateLocale = React.useMemo(() => resolveScheduleDateFnsLocale(appLocale), [appLocale])
  const visibleViewOptions = React.useMemo(() => {
    if (!viewModes?.length) return VIEW_OPTIONS
    const allowed = new Set(viewModes)
    return VIEW_OPTIONS.filter((option) => allowed.has(option.id))
  }, [viewModes])
  const rangeLength = React.useMemo(
    () => Math.max(1, differenceInCalendarDays(range.end, range.start) + 1),
    [range.end, range.start],
  )
  const deriveRangeForView = React.useCallback((base: Date, nextView: ScheduleViewMode): ScheduleRange => {
    if (nextView === 'day') {
      const start = startOfDay(base)
      return { start, end: endOfDay(start) }
    }
    if (nextView === 'week') {
      return {
        start: startOfWeek(base, { locale: dateLocale }),
        end: endOfWeek(base, { locale: dateLocale }),
      }
    }
    if (nextView === 'month') {
      return { start: startOfMonth(base), end: endOfMonth(base) }
    }
    const start = startOfDay(base)
    return { start, end: endOfDay(addDays(start, rangeLength - 1)) }
  }, [dateLocale, rangeLength])
  const rangeLabel = React.useMemo(() => {
    if (view === 'day') {
      return format(range.start, 'EEE, d MMM', { locale: dateLocale })
    }
    if (view === 'week') {
      const startLabel = format(range.start, 'd MMM', { locale: dateLocale })
      const endLabel = format(range.end, 'd MMM', { locale: dateLocale })
      const yearLabel = format(range.start, 'yyyy', { locale: dateLocale })
      return `${startLabel} – ${endLabel}, ${yearLabel}`
    }
    if (view === 'month') {
      return format(range.start, 'LLLL yyyy', { locale: dateLocale })
    }
    const startLabel = format(range.start, 'd MMM', { locale: dateLocale })
    const endLabel = format(range.end, 'd MMM yyyy', { locale: dateLocale })
    return `${startLabel} – ${endLabel}`
  }, [dateLocale, range.end, range.start, view])

  const shiftRange = React.useCallback((direction: 'prev' | 'next') => {
    const multiplier = direction === 'prev' ? -1 : 1
    if (view === 'day') {
      const nextStart = startOfDay(addDays(range.start, multiplier))
      onRangeChange({ start: nextStart, end: endOfDay(nextStart) })
      return
    }
    if (view === 'week') {
      const base = addWeeks(range.start, multiplier)
      onRangeChange({
        start: startOfWeek(base, { locale: dateLocale }),
        end: endOfWeek(base, { locale: dateLocale }),
      })
      return
    }
    if (view === 'month') {
      const base = addMonths(range.start, multiplier)
      onRangeChange({ start: startOfMonth(base), end: endOfMonth(base) })
      return
    }
    const nextStart = startOfDay(addDays(range.start, multiplier * rangeLength))
    onRangeChange({ start: nextStart, end: endOfDay(addDays(nextStart, rangeLength - 1)) })
  }, [dateLocale, onRangeChange, range.start, rangeLength, view])

  return (
    <div className={cn('flex flex-col gap-3 rounded-xl border bg-card p-4 md:flex-row md:items-center md:justify-between', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {visibleViewOptions.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant={view === option.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              if (option.id === view) return
              onViewChange(option.id)
              onRangeChange(deriveRangeForView(new Date(), option.id))
            }}
          >
            {t(option.labelKey, option.fallback)}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => shiftRange('prev')} aria-label={t('schedule.range.prev', 'Previous')}>
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <div className="text-sm font-medium text-foreground">{rangeLabel}</div>
        <Button type="button" variant="outline" size="sm" onClick={() => shiftRange('next')} aria-label={t('schedule.range.next', 'Next')}>
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t('schedule.range.start', 'Start')}</span>
          <Input
            type="date"
            value={formatDateInputValue(range.start)}
            onChange={(event) => {
              const nextStart = parseDateInputValue(event.target.value, range.start)
              onRangeChange({ start: nextStart, end: range.end })
            }}
            className="h-8 w-full sm:w-[140px]"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t('schedule.range.end', 'End')}</span>
          <Input
            type="date"
            value={formatDateInputValue(range.end)}
            onChange={(event) => {
              const nextEnd = parseDateInputValue(event.target.value, range.end)
              onRangeChange({ start: range.start, end: nextEnd })
            }}
            className="h-8 w-full sm:w-[140px]"
          />
        </label>
        {showTimezone ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{t('schedule.range.timezone', 'Timezone')}</span>
            <Input
              type="text"
              value={timezone ?? ''}
              onChange={(event) => onTimezoneChange?.(event.target.value)}
              className="h-8 w-full sm:w-[180px]"
              placeholder={t('schedule.range.timezone.placeholder', 'UTC')}
            />
          </label>
        ) : null}
      </div>
    </div>
  )
}
