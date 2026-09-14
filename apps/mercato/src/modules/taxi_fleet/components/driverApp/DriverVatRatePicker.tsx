'use client'

import React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { EXPENSE_VAT_RATES, type ExpenseVatRatePercent } from '../../lib/expenseVat'
import { driverLabelClass } from './driverUi'

type Props = {
  value: ExpenseVatRatePercent | null
  disabled?: boolean
  onChange: (next: ExpenseVatRatePercent | null) => void
}

export function DriverVatRatePicker({ value, disabled = false, onChange }: Props) {
  const t = useT()

  return (
    <div>
      <div className={driverLabelClass}>
        {t('taxi_fleet.driverApp.expenses.vatRate', 'VAT rate')}
        <span className="ml-1 font-normal text-[#78829D]">
          ({t('common.optional', 'optional')})
        </span>
      </div>
      <p className="mb-2 text-xs text-[#78829D]">
        {t(
          'taxi_fleet.driverApp.expenses.vatRateHint',
          'Leave empty to read VAT from the receipt photo. Choose 8% or 23% only when you already know the rate.',
        )}
      </p>
      <div
        className="grid grid-cols-2 gap-2"
        role="radiogroup"
        aria-label={t('taxi_fleet.driverApp.expenses.vatRate', 'VAT rate')}
      >
        {EXPENSE_VAT_RATES.map((rate) => {
          const selected = value === rate
          return (
            <Button
              key={rate}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(selected ? null : rate)}
              className={`h-auto min-h-11 rounded-md border px-2 py-2 text-sm shadow-none transition-colors ${
                selected
                  ? 'border-[#1B84FF] bg-[#EFF6FF] font-semibold text-[#1B84FF] hover:bg-[#EFF6FF]'
                  : 'border-[#DBDFE9] bg-white font-medium text-[#4B5675] hover:bg-[#F9F9F9] hover:text-[#071437]'
              }`}
            >
              {t(`taxi_fleet.driverApp.expenses.vatRates.${rate}`, `${rate}%`)}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
