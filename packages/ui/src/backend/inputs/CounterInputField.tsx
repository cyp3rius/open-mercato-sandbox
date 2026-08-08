'use client'

import * as React from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@open-mercato/shared/lib/utils'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '../CrudForm'
import { IconButton } from '../../primitives/icon-button'

export type CounterInputFieldProps = {
  value: string
  onChange: (next: string) => void
  min?: number
  max?: number
  disabled?: boolean
  className?: string
  id?: string
}

function parseCounterValue(value: string, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
}

export function CounterInputField({
  value,
  onChange,
  min = 0,
  max = 99,
  disabled = false,
  className,
  id,
}: CounterInputFieldProps) {
  const current = parseCounterValue(value, min)

  const setValue = React.useCallback(
    (next: number) => {
      const clamped = Math.min(max, Math.max(min, next))
      onChange(String(clamped))
    },
    [max, min, onChange],
  )

  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <IconButton
        type="button"
        variant="outline"
        size="default"
        className="size-9 shrink-0"
        disabled={disabled || current <= min}
        onClick={() => setValue(current - 1)}
        aria-label="Decrease"
      >
        <Minus className="size-4" aria-hidden />
      </IconButton>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        value={current}
        disabled={disabled}
        className={cn(CRUD_FORM_TEXT_INPUT_CLASS, 'w-14 text-center tabular-nums')}
        onChange={(event) => setValue(parseCounterValue(event.target.value, min))}
        data-crud-focus-target=""
      />
      <IconButton
        type="button"
        variant="outline"
        size="default"
        className="size-9 shrink-0"
        disabled={disabled || current >= max}
        onClick={() => setValue(current + 1)}
        aria-label="Increase"
      >
        <Plus className="size-4" aria-hidden />
      </IconButton>
    </div>
  )
}
