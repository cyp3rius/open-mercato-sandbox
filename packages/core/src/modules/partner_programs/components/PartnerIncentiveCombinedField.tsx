'use client'

import * as React from 'react'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import {
  PartnerIncentiveBaseRadioGroup,
  type PartnerIncentiveBase,
} from './PartnerIncentiveBaseRadioGroup'

type PartnerIncentiveCombinedFieldProps = {
  percent: string
  onPercentChange: (next: string) => void
  base: PartnerIncentiveBase | string
  onBaseChange: (next: PartnerIncentiveBase) => void
  disabled?: boolean
  percentLabel: string
  baseLabel: string
  netLabel: string
  grossLabel: string
  hint?: string
  showLabels?: boolean
}

export function PartnerIncentiveCombinedField({
  percent,
  onPercentChange,
  base,
  onBaseChange,
  disabled,
  percentLabel,
  baseLabel,
  netLabel,
  grossLabel,
  hint,
  showLabels = true,
}: PartnerIncentiveCombinedFieldProps) {
  return (
    <div className="space-y-2">
      {showLabels ? (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <Label htmlFor="partner-incentive-percent">{percentLabel}</Label>
          <span className="text-xs text-muted-foreground">{baseLabel}</span>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          id="partner-incentive-percent"
          type="number"
          min={0}
          max={100}
          step="0.01"
          className={`${CRUD_FORM_TEXT_INPUT_CLASS} sm:max-w-[8rem]`}
          value={percent}
          onChange={(ev) => onPercentChange(ev.target.value)}
          disabled={disabled}
        />
        <PartnerIncentiveBaseRadioGroup
          value={base}
          onChange={onBaseChange}
          disabled={disabled}
          groupLabel={baseLabel}
          netLabel={netLabel}
          grossLabel={grossLabel}
        />
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
