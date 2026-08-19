'use client'

import React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { EXPENSE_VAT_RATES, type ExpenseVatRatePercent } from '../../lib/expenseVat'
import { driverLabelClass } from './driverUi'

type Props = {
  value: ExpenseVatRatePercent
  disabled?: boolean
  onChange: (next: ExpenseVatRatePercent) => void
}

export function DriverVatRatePicker({ value, disabled = false, onChange }: Props) {
  const t = useT()

  return (
    <div>
      <div className={driverLabelClass}>{t('taxi_fleet.driverApp.expenses.vatRate', 'VAT rate')}</div>
      <p className="mb-2 text-xs text-[#78829D]">
        {t(
          'taxi_fleet.driverApp.expenses.vatRateHint',
          'Amount is gross on the receipt. Default 23%; choose 8% only when the receipt shows 8% VAT.',
        )}
      </p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('taxi_fleet.driverApp.expenses.vatRate', 'VAT rate')}>
        {EXPENSE_VAT_RATES.map((rate) => {
          const selected = value === rate
          return (
            <Button
              key={rate}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(rate)}
              className={`h-auto min-h-11 rounded-md border px-2 py-2 text-sm shadow-none ${
                selected
                  ? 'border-[#1B84FF] bg-[#EFF6FF] font-semibold text-[#1B84FF]'
                  : 'border-[#DBDFE9] bg-white font-medium text-[#4B5675]'
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
