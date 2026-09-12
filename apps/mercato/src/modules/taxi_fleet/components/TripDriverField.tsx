"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { LookupSelect, type LookupSelectItem } from '@open-mercato/ui/backend/inputs/LookupSelect'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { parseDateTimeLocalValue } from '../lib/datetimeLocal'

type DriverSuggestion = {
  teamMemberId: string
  displayName: string
  score: number
}

type TripDriverFieldProps = {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  driverOptions: LookupSelectItem[]
  startedAtLocal?: string
  endedAtLocal?: string
  lockedDisplayName?: string | null
}

export function TripDriverField({
  value,
  onChange,
  disabled = false,
  driverOptions,
  startedAtLocal = '',
  endedAtLocal = '',
  lockedDisplayName = null,
}: TripDriverFieldProps) {
  const t = useT()
  const [suggestions, setSuggestions] = React.useState<DriverSuggestion[]>([])

  React.useEffect(() => {
    if (lockedDisplayName) {
      setSuggestions([])
      return
    }
    const startedAt = parseDateTimeLocalValue(startedAtLocal)
    const endedAt = parseDateTimeLocalValue(endedAtLocal)
    if (!startedAt || !endedAt || endedAt <= startedAt) {
      setSuggestions([])
      return
    }
    const windowStart = startedAt
    const windowEnd = endedAt
    let cancelled = false
    async function loadSuggestions() {
      const params = new URLSearchParams({
        startedAt: windowStart.toISOString(),
        endedAt: windowEnd.toISOString(),
        limit: '5',
      })
      const call = await apiCall<{ items: DriverSuggestion[] }>(`/api/taxi_fleet/trips/suggest-drivers?${params}`)
      if (!cancelled) {
        setSuggestions(Array.isArray(call.result?.items) ? call.result.items : [])
      }
    }
    void loadSuggestions()
    return () => {
      cancelled = true
    }
  }, [endedAtLocal, lockedDisplayName, startedAtLocal])

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
    <div className="space-y-1.5">
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
      {suggestions.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs text-muted-foreground">
            {t('taxi_fleet.trips.suggestedDrivers', 'Suggested drivers')}:
          </span>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.teamMemberId}
              type="button"
              disabled={disabled}
              onClick={() => onChange(suggestion.teamMemberId)}
              className={
                value === suggestion.teamMemberId
                  ? 'text-xs font-medium text-primary'
                  : 'text-xs text-primary hover:underline disabled:pointer-events-none disabled:opacity-50'
              }
            >
              {suggestion.displayName}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
