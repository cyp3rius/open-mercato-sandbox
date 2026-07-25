'use client'

import * as React from 'react'
import { Button } from '@open-mercato/ui/primitives/button'

export type PartnerIncentiveBase = 'net' | 'gross'

type PartnerIncentiveBaseRadioGroupProps = {
  value: PartnerIncentiveBase | string
  onChange: (next: PartnerIncentiveBase) => void
  disabled?: boolean
  netLabel: string
  grossLabel: string
  groupLabel: string
}

export function PartnerIncentiveBaseRadioGroup({
  value,
  onChange,
  disabled,
  netLabel,
  grossLabel,
  groupLabel,
}: PartnerIncentiveBaseRadioGroupProps) {
  const selected: PartnerIncentiveBase = value === 'gross' ? 'gross' : 'net'
  const options: Array<{ value: PartnerIncentiveBase; label: string }> = [
    { value: 'net', label: netLabel },
    { value: 'gross', label: grossLabel },
  ]

  return (
    <div role="radiogroup" aria-label={groupLabel} className="inline-flex rounded-md border border-input p-0.5">
      {options.map((option) => {
        const isSelected = selected === option.value
        return (
          <Button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            variant={isSelected ? 'default' : 'ghost'}
            size="sm"
            disabled={disabled}
            className={
              isSelected ? 'rounded-sm px-3' : 'rounded-sm px-3 text-muted-foreground'
            }
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        )
      })}
    </div>
  )
}
