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
import { loadDriverAssignmentVehicleOptions } from '../lib/driverAssignmentVehicles'
import { useTaxiFleetSettings } from './useTaxiFleetSettings'
import { parseDateOnlyValue } from '../lib/datetimeLocal'

type ExpenseVehicleFieldProps = {
  teamMemberId: string
  occurredAtDate: string
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}

export function ExpenseVehicleField({
  teamMemberId,
  occurredAtDate,
  value,
  onChange,
  disabled = false,
}: ExpenseVehicleFieldProps) {
  const t = useT()
  const { resourceTypeId } = useTaxiFleetSettings()
  const [label, setLabel] = React.useState('')
  const [baseOptions, setBaseOptions] = React.useState<Array<{ value: string; label: string }>>([])
  const [defaultsLoaded, setDefaultsLoaded] = React.useState(false)

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
      setBaseOptions([])
      setDefaultsLoaded(false)
      return
    }
    let cancelled = false
    setDefaultsLoaded(false)
    const day = parseDateOnlyValue(occurredAtDate)
    void (async () => {
      const defaults = await loadDriverDefaultVehicleOptions(teamMemberId, resourceTypeId)
      let assignmentOptions: Array<{ value: string; label: string }> = []
      if (day) {
        const dayEnd = new Date(day)
        dayEnd.setHours(23, 59, 59, 999)
        assignmentOptions = await loadDriverAssignmentVehicleOptions(
          teamMemberId,
          day,
          dayEnd,
          resourceTypeId,
        )
      }
      if (cancelled) return
      const byId = new Map<string, { value: string; label: string }>()
      for (const option of [...assignmentOptions, ...defaults]) {
        if (!byId.has(option.value)) byId.set(option.value, option)
      }
      setBaseOptions([...byId.values()].sort((a, b) => a.label.localeCompare(b.label)))
      setDefaultsLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [occurredAtDate, resourceTypeId, teamMemberId])

  const useFleetFallback = defaultsLoaded && baseOptions.length === 0

  return (
    <EntitySearchCombobox
      value={value}
      onChange={onChange}
      disabled={disabled || !teamMemberId.trim() || !defaultsLoaded}
      className="min-w-0 w-full"
      options={mergeEntitySearchOption(baseOptions, value, label || value)}
      selectedDisplayOverride={label || undefined}
      onRemoteSearch={async (query) => {
        if (!teamMemberId.trim()) return []
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
        const merged = mergeEntitySearchOption(
          [...baseOptions, ...rows],
          value,
          label || value,
        )
        const trimmed = query.trim().toLowerCase()
        if (!trimmed) return merged
        return merged.filter(
          (option) =>
            option.label.toLowerCase().includes(trimmed) ||
            option.value.toLowerCase().includes(trimmed),
        )
      }}
      placeholder={t('taxi_fleet.financial.vehiclePlaceholder', 'Select vehicle…')}
      searchPlaceholder={t('taxi_fleet.drivers.vehicleSearch', 'Search vehicle…')}
      emptyText={t('taxi_fleet.drivers.vehicleEmpty', 'No vehicles found.')}
    />
  )
}
