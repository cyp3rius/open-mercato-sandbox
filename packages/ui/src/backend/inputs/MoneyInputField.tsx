'use client'

import * as React from 'react'
import { cn } from '@open-mercato/shared/lib/utils'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '../CrudForm'

export type MoneyInputFieldProps = {
  id?: string
  value: string
  onChange?: (value: string) => void
  disabled?: boolean
  readOnly?: boolean
  currency?: string
  placeholder?: string
  className?: string
}

export function MoneyInputField({
  id,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  currency = 'PLN',
  placeholder,
  className,
}: MoneyInputFieldProps) {
  return (
    <div className={cn('flex min-w-0 items-center', className)}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          CRUD_FORM_TEXT_INPUT_CLASS,
          'min-w-0 flex-1 rounded-r-none tabular-nums',
          readOnly && 'bg-muted/20',
        )}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        data-crud-focus-target=""
      />
      <div className="flex h-9 shrink-0 items-center rounded-r-md border border-l-0 bg-muted px-3 text-sm font-semibold text-muted-foreground">
        {currency}
      </div>
    </div>
  )
}
