'use client'

import React from 'react'
import { Award, Banknote, CreditCard, Landmark, Wallet } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import {
  TRIP_FORM_PAYMENT_OPTIONS,
  type TripFormPaymentOption,
} from '../../lib/tripRequestForm'
import { driverLabelClass } from './driverUi'

const PAYMENT_ICONS: Record<TripFormPaymentOption, typeof Wallet> = {
  electronic: Wallet,
  cash: Banknote,
  card: CreditCard,
  transfer: Landmark,
  loyalty_program: Award,
}

type Props = {
  value: TripFormPaymentOption
  disabled?: boolean
  onChange: (next: TripFormPaymentOption) => void
}

export function DriverPaymentTypePicker({ value, disabled = false, onChange }: Props) {
  const t = useT()

  return (
    <div>
      <div className={driverLabelClass}>
        {t('taxi_fleet.driverApp.trips.paymentType', 'Payment')}
      </div>
      <div
        className="grid grid-cols-2 gap-2"
        role="radiogroup"
        aria-label={t('taxi_fleet.driverApp.trips.paymentType', 'Payment')}
      >
        {TRIP_FORM_PAYMENT_OPTIONS.map((option) => {
          const Icon = PAYMENT_ICONS[option]
          const selected = value === option
          return (
            <Button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option)}
              className={`flex h-auto min-h-14 items-center justify-start gap-2 rounded-md border px-3 py-2.5 text-left shadow-none transition-colors ${
                selected
                  ? 'border-[#1B84FF] bg-[#EFF6FF] text-[#1B84FF] hover:bg-[#EFF6FF]'
                  : 'border-[#DBDFE9] bg-white text-[#4B5675] hover:bg-[#F9F9F9] hover:text-[#071437]'
              }`}
            >
              <Icon className="size-4 shrink-0" aria-hidden strokeWidth={selected ? 2.25 : 1.75} />
              <span className={`text-xs leading-tight ${selected ? 'font-semibold' : 'font-medium'}`}>
                {t(`taxi_fleet.trips.form.paymentTypes.${option}`, option)}
              </span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
