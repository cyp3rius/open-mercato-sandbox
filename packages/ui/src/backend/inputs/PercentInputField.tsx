'use client'

import * as React from 'react'
import { cn } from '@open-mercato/shared/lib/utils'
import {
  formatPercentInputValue,
  sanitizePercentTypingInput,
} from '@open-mercato/shared/lib/numeric'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '../CrudForm'

export type PercentInputFieldProps = {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  placeholder?: string
  min?: number
  max?: number
  id?: string
}

export function PercentInputField({
  value,
  onChange,
  disabled = false,
  placeholder = '0',
  min = 0,
  max = 100,
  id,
}: PercentInputFieldProps) {
  const [draft, setDraft] = React.useState(value)

  React.useEffect(() => {
    setDraft(formatPercentInputValue(value, { min, max }))
  }, [max, min, value])

  return (
    <div className="flex min-w-0 items-center">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={draft}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(CRUD_FORM_TEXT_INPUT_CLASS, 'rounded-r-none')}
        onChange={(event) => {
          const next = sanitizePercentTypingInput(event.target.value)
          setDraft(next)
          onChange(next)
        }}
        onBlur={() => {
          const formatted = formatPercentInputValue(draft, { min, max })
          setDraft(formatted)
          onChange(formatted)
        }}
        data-crud-focus-target=""
      />
      <div className="flex h-9 shrink-0 items-center rounded-r-md border border-l-0 bg-muted px-3 text-sm font-semibold text-muted-foreground">
        %
      </div>
    </div>
  )
}
