'use client'

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { LookupSelect, type LookupSelectItem } from '@open-mercato/ui/backend/inputs/LookupSelect'

type TripDriverFieldProps = {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  driverOptions: LookupSelectItem[]
  lockedDisplayName?: string | null
}

export function TripDriverField({
  value,
  onChange,
  disabled = false,
  driverOptions,
  lockedDisplayName = null,
}: TripDriverFieldProps) {
  const t = useT()

  const selectedLabel =
    lockedDisplayName ??
    driverOptions.find((option) => option.id === value)?.title ??
    null

  // Read-only / locked trips: plain text only — LookupSelect still exposed a clear control when disabled.
  if (disabled || lockedDisplayName) {
    return (
      <p className="text-sm text-foreground">
        {selectedLabel || t('taxi_fleet.trips.noDriver', '—')}
      </p>
    )
  }

  return (
    <LookupSelect
      value={value.length ? value : null}
      onChange={(next) => onChange(next ?? '')}
      options={driverOptions}
      minQuery={0}
      fetchOptions={async (query) =>
        driverOptions.filter((option) =>
          !query?.trim() ? true : option.title.toLowerCase().includes(query.trim().toLowerCase()),
        )
      }
      placeholder={t('taxi_fleet.trips.pickDriver', 'Select driver…')}
      disabled={disabled}
    />
  )
}
