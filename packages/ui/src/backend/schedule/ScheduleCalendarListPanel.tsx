"use client"

import * as React from 'react'
import { cn } from '@open-mercato/shared/lib/utils'
import {
  SchedulePresentationSwitch,
  type SchedulePresentationMode,
} from './SchedulePresentationSwitch'

export type ScheduleCalendarListPanelProps = {
  mode: SchedulePresentationMode
  onModeChange: (mode: SchedulePresentationMode) => void
  listLabel: string
  calendarLabel: string
  listContent: React.ReactNode
  calendarContent: React.ReactNode
  headerActions?: React.ReactNode
  className?: string
  toolbarClassName?: string
  disabled?: boolean
}

export function ScheduleCalendarListPanel({
  mode,
  onModeChange,
  listLabel,
  calendarLabel,
  listContent,
  calendarContent,
  headerActions,
  className,
  toolbarClassName,
  disabled = false,
}: ScheduleCalendarListPanelProps) {
  return (
    <div
      className={cn(
        mode === 'calendar'
          ? 'flex h-[calc(100svh-14rem)] max-h-[calc(100svh-14rem)] flex-col gap-4 overflow-hidden'
          : 'space-y-4',
        className,
      )}
    >
      <div className={cn('flex shrink-0 flex-wrap items-center justify-end gap-2', toolbarClassName)}>
        {headerActions}
        <SchedulePresentationSwitch
          mode={mode}
          onModeChange={onModeChange}
          listLabel={listLabel}
          calendarLabel={calendarLabel}
          disabled={disabled}
        />
      </div>
      <div className={mode === 'calendar' ? 'flex min-h-0 flex-1 flex-col' : undefined}>
        {mode === 'calendar' ? calendarContent : listContent}
      </div>
    </div>
  )
}
