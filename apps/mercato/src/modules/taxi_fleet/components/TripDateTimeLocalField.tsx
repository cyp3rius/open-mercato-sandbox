'use client'

import * as React from 'react'
import { cn } from '@open-mercato/shared/lib/utils'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { DATETIME_LOCAL_FIVE_MINUTE_STEP_SECONDS, normalizeDateTimeLocalInput } from '../lib/datetimeLocal'

type TripDateTimeLocalFieldProps = {
  id: string
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  readOnly?: boolean
  autoFocus?: boolean
  min?: string
}

export function TripDateTimeLocalField({
  id,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  autoFocus = false,
  min,
}: TripDateTimeLocalFieldProps) {
  return (
    <input
      id={id}
      type="datetime-local"
      step={DATETIME_LOCAL_FIVE_MINUTE_STEP_SECONDS}
      className={cn(CRUD_FORM_TEXT_INPUT_CLASS, readOnly && 'bg-muted/20')}
      value={value}
      min={min}
      onChange={(event) => {
        if (disabled || readOnly) return
        onChange(normalizeDateTimeLocalInput(event.target.value))
      }}
      disabled={disabled}
      readOnly={readOnly}
      autoFocus={autoFocus}
      data-crud-focus-target=""
    />
  )
}
