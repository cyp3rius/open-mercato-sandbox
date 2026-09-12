'use client'

import React from 'react'
import {
  CircleParking,
  Ellipsis,
  Fuel,
  Landmark,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { TAXI_FLEET_COST_TYPES, type TaxiFleetCostType } from '../../lib/costTypes'
import { driverLabelClass } from './driverUi'

const COST_TYPE_ICONS: Record<TaxiFleetCostType, LucideIcon> = {
  fuel: Fuel,
  toll: Landmark,
  parking: CircleParking,
  maintenance: Wrench,
  other: Ellipsis,
}

type CostType = TaxiFleetCostType

type Props = {
  value: CostType
  disabled?: boolean
  onChange: (next: CostType) => void
}

export function DriverCostTypePicker({ value, disabled = false, onChange }: Props) {
  const t = useT()

  return (
    <div>
      <div className={driverLabelClass}>
        {t('taxi_fleet.driverApp.expenses.costType', 'Cost type')}
      </div>
      <div
        className="grid grid-cols-3 gap-2"
        role="radiogroup"
        aria-label={t('taxi_fleet.driverApp.expenses.costType', 'Cost type')}
      >
        {TAXI_FLEET_COST_TYPES.map((type) => {
          const Icon = COST_TYPE_ICONS[type]
          const selected = value === type
          return (
            <Button
              key={type}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(type)}
              className={`flex h-auto min-h-18 flex-col items-center justify-center gap-1.5 rounded-md border px-2 py-2.5 text-center shadow-none transition-colors ${
                selected
                  ? 'border-[#1B84FF] bg-[#EFF6FF] text-[#1B84FF] hover:bg-[#EFF6FF]'
                  : 'border-[#DBDFE9] bg-white text-[#4B5675] hover:bg-[#F9F9F9] hover:text-[#071437]'
              }`}
            >
              <Icon className="size-5 shrink-0" aria-hidden strokeWidth={selected ? 2.25 : 1.75} />
              <span className={`text-xs leading-tight ${selected ? 'font-semibold' : 'font-medium'}`}>
                {t(`taxi_fleet.financial.costTypes.${type}`, type)}
              </span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
