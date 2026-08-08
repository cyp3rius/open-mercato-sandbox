"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import {
  mergeEntitySearchOption,
  resolveResourceDisplayLabel,
} from '@open-mercato/core/modules/procurement/lib/procurementEntitySearch'
import { remoteSearchFleetResources } from '../lib/fleetResourceSearch'
import { useTaxiFleetSettings } from './useTaxiFleetSettings'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'

type ResourceSearchFieldProps = {
  value: string
  onChange: (next: string) => void
  disabled?: boolean
}

export function ResourceSearchField({ value, onChange, disabled = false }: ResourceSearchFieldProps) {
  const t = useT()
  const { resourceTypeId } = useTaxiFleetSettings()
  const [label, setLabel] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    const trimmed = value.trim()
    if (!trimmed.length) {
      setLabel('')
      return
    }
    void resolveResourceDisplayLabel(trimmed).then((resolved) => {
      if (!cancelled) setLabel(resolved ?? trimmed)
    })
    return () => {
      cancelled = true
    }
  }, [value])

  return (
    <EntitySearchCombobox
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="min-w-0 w-full"
      options={mergeEntitySearchOption([], value, label || value)}
      selectedDisplayOverride={label || undefined}
      onRemoteSearch={async (query) => {
        const rows = await remoteSearchFleetResources(query, resourceTypeId)
        return mergeEntitySearchOption(rows, value, label || value)
      }}
      placeholder={t('taxi_fleet.trips.pickVehicle', 'Select vehicle…')}
      searchPlaceholder={t('taxi_fleet.drivers.vehicleSearch', 'Search vehicle…')}
      emptyText={t('taxi_fleet.drivers.vehicleEmpty', 'No vehicles found.')}
    />
  )
}
