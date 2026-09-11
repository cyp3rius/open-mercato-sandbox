"use client"

import * as React from 'react'
import { cn } from '@open-mercato/shared/lib/utils'
import { FormActionButtons, type FormActionButtonsProps } from './FormActionButtons'

export type FormFooterProps = {
  /** Action buttons to render */
  actions: FormActionButtonsProps
  /** When embedded, justify-end; otherwise justify-between */
  embedded?: boolean
  /** Extra className for dialog sticky positioning */
  className?: string
}

export function FormFooter({ actions, embedded, className }: FormFooterProps) {
  return (
    <div
      className={cn('relative flex w-full items-center gap-2 overflow-visible', className)}
      data-form-footer={embedded ? 'embedded' : 'page'}
    >
      <FormActionButtons {...actions} className="w-full" />
    </div>
  )
}
