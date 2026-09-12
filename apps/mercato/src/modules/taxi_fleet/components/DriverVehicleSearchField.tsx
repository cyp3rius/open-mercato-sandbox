'use client'

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { mergeEntitySearchOption } from '@open-mercato/core/modules/procurement/lib/procurementEntitySearch'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import {
  loadDriverDefaultVehicleOptions,
  resolveDriverVehicleLabel,
  searchDriverDefaultVehicleOptions,
  searchFallbackResourceOptions,
} from '../lib/driverDefaultVehiclesClient'
import { useTaxiFleetSettings } from './useTaxiFleetSettings'

type DriverVehicleSearchFieldProps = {
  teamMemberId: string
  startedAtLocal: string
  endedAtLocal: string
  value: string
  onChange: (next: string) => void
  disabled?: boolean
  /** When profile has no default vehicles, search the full fleet. */
  fallbackToAllResources?: boolean
}

function parseDateTimeLocalValue(value: string): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function DriverVehicleSearchField({
  teamMemberId,
  startedAtLocal,
  endedAtLocal,
  value,
  onChange,
  disabled = false,
  fallbackToAllResources = true,
}: DriverVehicleSearchFieldProps) {
  const t = useT()
  const { resourceTypeId } = useTaxiFleetSettings()
  const [label, setLabel] = React.useState('')
  const [defaultOptions, setDefaultOptions] = React.useState<Array<{ value: string; label: string }>>([])
  const [defaultsLoaded, setDefaultsLoaded] = React.useState(false)

  const window = React.useMemo(() => {
    const startedAt = parseDateTimeLocalValue(startedAtLocal)
    const endedAt = parseDateTimeLocalValue(endedAtLocal)
    if (!startedAt || !endedAt || endedAt <= startedAt) return null
    return { startedAt, endedAt }
  }, [endedAtLocal, startedAtLocal])

  React.useEffect(() => {
    let cancelled = false
    const trimmed = value.trim()
    if (!trimmed.length) {
      setLabel('')
      return
    }
    void resolveDriverVehicleLabel(trimmed).then((resolved) => {
      if (!cancelled) setLabel(resolved ?? trimmed)
    })
    return () => {
      cancelled = true
    }
  }, [value])

  React.useEffect(() => {
    if (!teamMemberId.trim()) {
      setDefaultOptions([])
      setDefaultsLoaded(false)
      return
    }
    let cancelled = false
    setDefaultsLoaded(false)
    void loadDriverDefaultVehicleOptions(teamMemberId, resourceTypeId).then((options) => {
      if (cancelled) return
      setDefaultOptions(options)
      setDefaultsLoaded(true)
    })
    return () => {
      cancelled = true
    }
  }, [resourceTypeId, teamMemberId])

  const useFleetFallback = fallbackToAllResources && defaultsLoaded && defaultOptions.length === 0

  const emptyText =
    defaultsLoaded && defaultOptions.length === 0 && !fallbackToAllResources
      ? t(
          'taxi_fleet.trips.noDefaultVehicles',
          'No default vehicles configured for this driver.',
        )
      : t('taxi_fleet.drivers.vehicleEmpty', 'No vehicles found.')

  return (
    <EntitySearchCombobox
      value={value}
      onChange={onChange}
      disabled={disabled || !window || !teamMemberId.trim() || !defaultsLoaded}
      className="min-w-0 w-full"
      options={mergeEntitySearchOption(defaultOptions, value, label || value)}
      selectedDisplayOverride={label || undefined}
      onRemoteSearch={async (query) => {
        if (!window || !teamMemberId.trim()) return []
        if (useFleetFallback) {
          const rows = await searchFallbackResourceOptions(query, resourceTypeId)
          return mergeEntitySearchOption(rows, value, label || value)
        }
        const rows = await searchDriverDefaultVehicleOptions(
          teamMemberId,
          query,
          value,
          label || value,
          resourceTypeId,
        )
        return mergeEntitySearchOption(rows, value, label || value)
      }}
      placeholder={t('taxi_fleet.trips.pickVehicle', 'Select vehicle…')}
      searchPlaceholder={t('taxi_fleet.drivers.vehicleSearch', 'Search vehicle…')}
      emptyText={emptyText}
    />
  )
}
