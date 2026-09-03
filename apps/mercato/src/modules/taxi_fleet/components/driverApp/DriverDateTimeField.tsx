'use client'

import React from 'react'
import { driverFieldClass, driverLabelClass } from './driverUi'

type Props = {
  id: string
  label: string
  value: string
  disabled?: boolean
  onChange: (nextLocal: string) => void
}

/** `datetime-local` overflows on iOS; use separate date + time fields. */
export function DriverDateTimeField({ id, label, value, disabled, onChange }: Props) {
  const datePart = value.slice(0, 10)
  const timePart = value.length >= 16 ? value.slice(11, 16) : ''

  return (
    <div className="min-w-0">
      <label htmlFor={`${id}-date`} className={driverLabelClass}>
        {label}
      </label>
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <input
          id={`${id}-date`}
          type="date"
          disabled={disabled}
          value={datePart}
          onChange={(event) => {
            const nextDate = event.target.value
            onChange(nextDate ? `${nextDate}T${timePart || '00:00'}` : '')
          }}
          className={`${driverFieldClass} min-w-0 max-w-full`}
        />
        <input
          id={`${id}-time`}
          type="time"
          disabled={disabled}
          value={timePart}
          onChange={(event) => {
            const nextTime = event.target.value
            onChange(`${datePart || new Date().toISOString().slice(0, 10)}T${nextTime || '00:00'}`)
          }}
          className={`${driverFieldClass} min-w-0 max-w-full`}
        />
      </div>
    </div>
  )
}
