'use client'

import * as React from 'react'
import { cn } from '@open-mercato/shared/lib/utils'
import { Switch } from '@open-mercato/ui/primitives/switch'

type TripFormSwitchFieldProps = {
  label: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
  readOnly?: boolean
}

export function TripFormSwitchField({
  label,
  checked,
  onChange,
  disabled = false,
  readOnly = false,
}: TripFormSwitchFieldProps) {
  return (
    <div
      className={cn(
        'flex h-9 w-full items-center justify-between gap-3 rounded-md border border-border/60 px-3',
        readOnly ? 'bg-muted/20' : 'bg-background/80',
      )}
    >
      <span className="text-sm font-medium leading-tight">{label}</span>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled || readOnly}
        className="shrink-0"
      />
    </div>
  )
}
