"use client"

import * as React from 'react'
import { Calendar, List } from 'lucide-react'
import { Button } from '../../primitives/button'
import { cn } from '@open-mercato/shared/lib/utils'

export type SchedulePresentationMode = 'list' | 'calendar'

export type SchedulePresentationSwitchProps = {
  mode: SchedulePresentationMode
  onModeChange: (mode: SchedulePresentationMode) => void
  listLabel: string
  calendarLabel: string
  className?: string
  disabled?: boolean
}

export function SchedulePresentationSwitch({
  mode,
  onModeChange,
  listLabel,
  calendarLabel,
  className,
  disabled = false,
}: SchedulePresentationSwitchProps) {
  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={disabled}
        onClick={() => onModeChange('list')}
        aria-label={listLabel}
        title={listLabel}
        className={mode === 'list' ? 'bg-accent text-accent-foreground' : undefined}
      >
        <List className="size-4" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={disabled}
        onClick={() => onModeChange('calendar')}
        aria-label={calendarLabel}
        title={calendarLabel}
        className={mode === 'calendar' ? 'bg-accent text-accent-foreground' : undefined}
      >
        <Calendar className="size-4" aria-hidden />
      </Button>
    </div>
  )
}
