"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { mergeEntitySearchOption } from '@open-mercato/core/modules/procurement/lib/procurementEntitySearch'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import {
  loadDriverAssignmentVehicleOptions,
  resolveDriverAssignmentVehicleLabel,
  searchDriverAssignmentVehicleOptions,
  searchFallbackResourceOptions,
} from '../lib/driverAssignmentVehicles'
import { useTaxiFleetSettings } from './useTaxiFleetSettings'

type DriverVehicleSearchFieldProps = {
  teamMemberId: string
  startedAtLocal: string
  endedAtLocal: string
  value: string
  onChange: (next: string) => void
  disabled?: boolean
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
  const [assignmentOptions, setAssignmentOptions] = React.useState<Array<{ value: string; label: string }>>([])

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
    void resolveDriverAssignmentVehicleLabel(trimmed).then((resolved) => {
      if (!cancelled) setLabel(resolved ?? trimmed)
    })
    return () => {
      cancelled = true
    }
  }, [value])

  React.useEffect(() => {
    if (!window || !teamMemberId) {
      setAssignmentOptions([])
      return
    }
    let cancelled = false
    void loadDriverAssignmentVehicleOptions(teamMemberId, window.startedAt, window.endedAt, resourceTypeId).then((options) => {
      if (!cancelled) setAssignmentOptions(options)
    })
    return () => {
      cancelled = true
    }
  }, [resourceTypeId, teamMemberId, window])

  const emptyText =
    window && assignmentOptions.length === 0 && !fallbackToAllResources
      ? t('taxi_fleet.trips.noVehiclesForDay', 'No vehicles assigned to this driver for the selected time.')
      : t('taxi_fleet.drivers.vehicleEmpty', 'No vehicles found.')

  return (
    <EntitySearchCombobox
      value={value}
      onChange={onChange}
      disabled={disabled || !window}
      className="min-w-0 w-full"
      options={mergeEntitySearchOption(assignmentOptions, value, label || value)}
      selectedDisplayOverride={label || undefined}
      onRemoteSearch={async (query) => {
        if (!window) return []
        if (fallbackToAllResources && assignmentOptions.length === 0) {
          const rows = await searchFallbackResourceOptions(query, resourceTypeId)
          return mergeEntitySearchOption(rows, value, label || value)
        }
        const rows = await searchDriverAssignmentVehicleOptions(
          teamMemberId,
          window.startedAt,
          window.endedAt,
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
