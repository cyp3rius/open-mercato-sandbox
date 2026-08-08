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
    <div className={cn('space-y-4', className)}>
      <div className={cn('flex flex-wrap items-center justify-end gap-2', toolbarClassName)}>
        {headerActions}
        <SchedulePresentationSwitch
          mode={mode}
          onModeChange={onModeChange}
          listLabel={listLabel}
          calendarLabel={calendarLabel}
          disabled={disabled}
        />
      </div>
      {mode === 'calendar' ? calendarContent : listContent}
    </div>
  )
}
