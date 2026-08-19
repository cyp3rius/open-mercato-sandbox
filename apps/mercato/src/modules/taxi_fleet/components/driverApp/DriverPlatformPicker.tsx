'use client'

import React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { TAXI_FLEET_TRIP_PLATFORMS, type TaxiFleetTripPlatform } from '../../lib/tripPlatforms'
import { driverLabelClass } from './driverUi'

type Props = {
  value: TaxiFleetTripPlatform | null
  disabled?: boolean
  onChange: (next: TaxiFleetTripPlatform | null) => void
}

export function DriverPlatformPicker({ value, disabled = false, onChange }: Props) {
  const t = useT()

  return (
    <div>
      <div className={driverLabelClass}>{t('taxi_fleet.trips.platform', 'Platform')}</div>
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        role="radiogroup"
        aria-label={t('taxi_fleet.trips.platform', 'Platform')}
      >
        <Button
          type="button"
          role="radio"
          aria-checked={value == null}
          disabled={disabled}
          onClick={() => onChange(null)}
          className={`h-auto min-h-11 rounded-md border px-2 py-2 text-xs shadow-none ${
            value == null
              ? 'border-[#1B84FF] bg-[#EFF6FF] font-semibold text-[#1B84FF]'
              : 'border-[#DBDFE9] bg-white font-medium text-[#4B5675]'
          }`}
        >
          {t('taxi_fleet.trips.platforms.none', 'None')}
        </Button>
        {TAXI_FLEET_TRIP_PLATFORMS.map((platform) => {
          const selected = value === platform
          return (
            <Button
              key={platform}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(platform)}
              className={`h-auto min-h-11 rounded-md border px-2 py-2 text-xs shadow-none ${
                selected
                  ? 'border-[#1B84FF] bg-[#EFF6FF] font-semibold text-[#1B84FF]'
                  : 'border-[#DBDFE9] bg-white font-medium text-[#4B5675]'
              }`}
            >
              {t(`taxi_fleet.trips.platforms.${platform}`, platform)}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
