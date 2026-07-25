'use client'

import * as React from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@open-mercato/ui/primitives/button'

type DetailTabAddToolbarProps = {
  label: React.ReactNode
  onClick: () => void
  disabled?: boolean
  className?: string
}

/** In-tab create action for non-empty lists (CRUD-style toolbar). Empty tabs use TabEmptyState instead. */
export function DetailTabAddToolbar({
  label,
  onClick,
  disabled,
  className,
}: DetailTabAddToolbarProps) {
  return (
    <div className={className ?? 'flex justify-end'}>
      <Button type="button" size="sm" onClick={onClick} disabled={disabled}>
        <Plus className="mr-2 h-4 w-4" />
        {label}
      </Button>
    </div>
  )
}
