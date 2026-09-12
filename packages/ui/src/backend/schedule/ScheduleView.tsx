"use client"

import * as React from 'react'
import { Calendar, dateFnsLocalizer, type View, type SlotInfo } from 'react-big-calendar'
import { addDays, differenceInCalendarDays, endOfDay, endOfMonth, endOfWeek, format, getDay, parse, startOfDay, startOfMonth, startOfWeek } from 'date-fns'
import type { Locale as DateFnsLocale } from 'date-fns'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import type { ScheduleItem, ScheduleRange, ScheduleSlot, ScheduleViewMode } from './types'
import { ScheduleToolbar } from './ScheduleToolbar'
import { Button } from '../../primitives/button'
import { expandRecurringItems } from './recurrence'
import { resolveScheduleCulture, resolveScheduleDateFnsLocale, SCHEDULE_DATE_FNS_LOCALES } from './dateLocale'

type CalendarEvent = {
  id: string
  title: string
  start: Date
  end: Date
  resource: ScheduleItem
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: SCHEDULE_DATE_FNS_LOCALES,
})

const VIEW_MAP: Record<ScheduleViewMode, View> = {
  day: 'day',
  week: 'week',
  month: 'month',
  agenda: 'agenda',
}

function deriveRange(
  date: Date,
  view: ScheduleViewMode,
  agendaLength: number,
  dateLocale: DateFnsLocale,
): ScheduleRange {
  if (view === 'day') {
    return { start: startOfDay(date), end: endOfDay(date) }
  }
  if (view === 'week') {
    return {
      start: startOfWeek(date, { locale: dateLocale }),
      end: endOfWeek(date, { locale: dateLocale }),
    }
  }
  if (view === 'month') {
    return { start: startOfMonth(date), end: endOfMonth(date) }
  }
  const length = Math.max(1, agendaLength)
  return { start: startOfDay(date), end: endOfDay(addDays(date, length - 1)) }
}

function normalizeRange(
  nextRange: Date[] | { start: Date; end: Date } | null | undefined,
  view: ScheduleViewMode,
  agendaLength: number,
  dateLocale: DateFnsLocale,
): ScheduleRange | null {
  if (!nextRange) return null
  if (Array.isArray(nextRange)) {
    if (nextRange.length === 0) return null
    if (view === 'agenda') {
      return { start: nextRange[0], end: nextRange[nextRange.length - 1] }
    }
    return deriveRange(nextRange[0], view, agendaLength, dateLocale)
  }
  if (nextRange.start && nextRange.end) return { start: nextRange.start, end: nextRange.end }
  return deriveRange(new Date(), view, agendaLength, dateLocale)
}

function parseCssColor(color: string): { r: number; g: number; b: number } | null {
  const trimmed = color.trim()
  const hex = trimmed.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  if (hex) {
    const raw = hex[1]
    const full = raw.length === 3 ? raw.split('').map((ch) => `${ch}${ch}`).join('') : raw
    return {
      r: Number.parseInt(full.slice(0, 2), 16),
      g: Number.parseInt(full.slice(2, 4), 16),
      b: Number.parseInt(full.slice(4, 6), 16),
    }
  }
  const rgb = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) }
  }
  return null
}

function withAlpha(color: string, alpha: number): string {
  const parsed = parseCssColor(color)
  if (!parsed) return color
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${alpha})`
}

function getEventStyles(item: ScheduleItem): React.CSSProperties {
  if (item.color?.trim()) {
    const accent = item.color.trim()
    return {
      backgroundColor: withAlpha(accent, item.kind === 'availability' ? 0.12 : 0.18),
      border: `1px solid ${withAlpha(accent, 0.55)}`,
      borderLeft: `3px solid ${accent}`,
      color: '#0f172a',
    }
  }
  if (item.kind === 'event') {
    return { backgroundColor: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.5)', borderLeft: '3px solid #3b82f6', color: '#1e3a8a' }
  }
  if (item.kind === 'exception') {
    return { backgroundColor: 'rgba(148, 163, 184, 0.2)', border: '1px solid rgba(100, 116, 139, 0.6)', borderLeft: '3px solid #64748b', color: '#334155' }
  }
  return { backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.5)', borderLeft: '3px solid #10b981', color: '#064e3b' }
}

export type ScheduleViewProps = {
  items: ScheduleItem[]
  view: ScheduleViewMode
  range: ScheduleRange
  timezone?: string
  onRangeChange: (range: ScheduleRange) => void
  onViewChange: (view: ScheduleViewMode) => void
  onItemClick?: (item: ScheduleItem) => void
  onSlotClick?: (slot: ScheduleSlot) => void
  onTimezoneChange?: (timezone: string) => void
  showTimezone?: boolean
  viewModes?: ScheduleViewMode[]
  className?: string
  /** When provided, replaces the default event cell content. */
  renderEvent?: (item: ScheduleItem) => React.ReactNode
  /**
   * When true (default), the calendar fills remaining vertical space of its parent
   * (or a viewport-based minimum when the parent has no fixed height).
   */
  fillAvailable?: boolean
}

const DEFAULT_CALENDAR_HEIGHT = 640

export function ScheduleView({
  items,
  view,
  range,
  timezone,
  onRangeChange,
  onViewChange,
  onItemClick,
  onSlotClick,
  onTimezoneChange,
  showTimezone = true,
  viewModes,
  className,
  renderEvent,
  fillAvailable = true,
}: ScheduleViewProps) {
  const t = useT()
  const appLocale = useLocale()
  const dateLocale = React.useMemo(() => resolveScheduleDateFnsLocale(appLocale), [appLocale])
  const culture = React.useMemo(() => resolveScheduleCulture(appLocale), [appLocale])
  const agendaLength = React.useMemo(
    () => Math.max(1, differenceInCalendarDays(range.end, range.start) + 1),
    [range.end, range.start],
  )
  const currentView = VIEW_MAP[view]
  const expandedItems = React.useMemo(() => expandRecurringItems(items, range), [items, range])
  const events = React.useMemo<CalendarEvent[]>(
    () => expandedItems.map((item) => ({
      id: item.id,
      title: item.title,
      start: item.startsAt,
      end: item.endsAt,
      resource: item,
    })),
    [expandedItems],
  )
  const calendarMessages = React.useMemo(
    () => ({
      date: t('schedule.messages.date', 'Date'),
      time: t('schedule.messages.time', 'Time'),
      event: t('schedule.messages.event', 'Event'),
      allDay: t('schedule.messages.allDay', 'All day'),
      week: t('schedule.view.week', 'Week'),
      work_week: t('schedule.view.week', 'Week'),
      day: t('schedule.view.day', 'Day'),
      month: t('schedule.view.month', 'Month'),
      previous: t('schedule.range.prev', 'Previous'),
      next: t('schedule.range.next', 'Next'),
      yesterday: t('schedule.messages.yesterday', 'Yesterday'),
      tomorrow: t('schedule.messages.tomorrow', 'Tomorrow'),
      today: t('schedule.messages.today', 'Today'),
      agenda: t('schedule.view.agenda', 'Agenda'),
      noEventsInRange: t('schedule.messages.noEventsInRange', 'No events in this range.'),
      showMore: (total: number) =>
        t('schedule.messages.showMore', '+{total} more', { total: String(total) }),
    }),
    [t],
  )
  const calendarFormats = React.useMemo(
    () => ({
      dayFormat: 'd EEE',
      weekdayFormat: 'EEE',
      timeGutterFormat: 'HH:mm',
      eventTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
        `${format(start, 'HH:mm', { locale: dateLocale })}–${format(end, 'HH:mm', { locale: dateLocale })}`,
      dayHeaderFormat: 'EEEE, d MMMM',
      dayRangeHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
        `${format(start, 'd MMM', { locale: dateLocale })} – ${format(end, 'd MMM yyyy', { locale: dateLocale })}`,
      monthHeaderFormat: 'LLLL yyyy',
      agendaDateFormat: 'EEE d MMM',
      agendaTimeFormat: 'HH:mm',
      agendaHeaderFormat: ({ start, end }: { start: Date; end: Date }) =>
        `${format(start, 'd MMM', { locale: dateLocale })} – ${format(end, 'd MMM yyyy', { locale: dateLocale })}`,
    }),
    [dateLocale],
  )

  const handleNavigate = React.useCallback((date: Date, nextView?: View) => {
    const resolvedView = (nextView ?? currentView) as ScheduleViewMode
    onRangeChange(deriveRange(date, resolvedView, agendaLength, dateLocale))
  }, [agendaLength, currentView, dateLocale, onRangeChange])

  const handleRangeChange = React.useCallback((nextRange: Date[] | { start: Date; end: Date }, nextView?: View) => {
    const resolvedView = (nextView ?? currentView) as ScheduleViewMode
    const normalized = normalizeRange(nextRange, resolvedView, agendaLength, dateLocale)
    if (normalized) onRangeChange(normalized)
  }, [agendaLength, currentView, dateLocale, onRangeChange])

  const handleViewChange = React.useCallback((nextView: View) => {
    const resolved = nextView as ScheduleViewMode
    if (resolved !== view) {
      onViewChange(resolved)
      onRangeChange(deriveRange(new Date(), resolved, agendaLength, dateLocale))
    }
  }, [agendaLength, dateLocale, onRangeChange, onViewChange, view])

  const rootClassName = [
    'schedule-view',
    fillAvailable
      ? 'flex h-full max-h-full min-h-0 flex-1 flex-col overflow-hidden'
      : null,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootClassName}>
      <style>{`
        .schedule-view .schedule-calendar {
          min-height: 0;
        }
        .schedule-view .rbc-calendar {
          height: 100%;
        }
        .schedule-view .rbc-event {
          overflow: hidden;
          padding: 3px 5px;
          border-radius: 6px;
          box-sizing: border-box;
        }
        /* RBC always renders a time label above custom event content — hide it. */
        .schedule-view .rbc-event-label,
        .schedule-view .rbc-event > .rbc-event-label {
          display: none !important;
        }
        .schedule-view .rbc-event-content {
          height: 100%;
          min-height: 0;
          width: 100%;
        }
        .schedule-view .rbc-addons-dnd-resizable {
          height: 100%;
        }
        .schedule-view .rbc-month-view .rbc-event {
          padding: 1px 4px;
        }
        /* Slight gap between side-by-side overlapping events (no-overlap layout). */
        .schedule-view .rbc-day-slot .rbc-events-container {
          margin-right: 0;
        }
        .schedule-view .rbc-day-slot .rbc-event {
          margin-right: 2px;
        }
      `}</style>
      <div className="shrink-0">
        <ScheduleToolbar
          view={view}
          range={range}
          timezone={timezone}
          onRangeChange={onRangeChange}
          onViewChange={onViewChange}
          onTimezoneChange={onTimezoneChange}
          showTimezone={showTimezone}
          viewModes={viewModes}
        />
      </div>
      <div
        className={[
          'schedule-calendar mt-4 rounded-xl border bg-card p-3',
          fillAvailable ? 'min-h-0 flex-1 overflow-hidden' : null,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Calendar
          localizer={localizer}
          culture={culture}
          formats={calendarFormats}
          messages={calendarMessages}
          events={events}
          view={currentView}
          date={range.start}
          toolbar={false}
          selectable={Boolean(onSlotClick)}
          popup
          length={agendaLength}
          dayLayoutAlgorithm="no-overlap"
          tooltipAccessor={() => ''}
          onView={handleViewChange}
          onNavigate={handleNavigate}
          onRangeChange={handleRangeChange}
          onSelectEvent={(event: CalendarEvent) => onItemClick?.(event.resource)}
          onSelectSlot={(slot: SlotInfo) => {
            if (!onSlotClick) return
            onSlotClick({ start: slot.start, end: slot.end })
          }}
          eventPropGetter={(event: CalendarEvent) => ({
            style: getEventStyles(event.resource),
          })}
          components={{
            event: ({ event }: { event: CalendarEvent }) => {
              const resource = event.resource
              if (renderEvent) {
                return <>{renderEvent(resource)}</>
              }
              const hasLink = Boolean(resource.linkLabel) && typeof onItemClick === 'function'
              return (
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium">{resource.title}</span>
                  {hasLink ? (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-[11px]"
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation()
                        onItemClick?.(resource)
                      }}
                    >
                      {resource.linkLabel}
                    </Button>
                  ) : null}
                </div>
              )
            },
          }}
          style={{ height: fillAvailable ? '100%' : DEFAULT_CALENDAR_HEIGHT }}
        />
      </div>
    </div>
  )
}
