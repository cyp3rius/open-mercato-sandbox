'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { mergeEntitySearchOption } from '@open-mercato/core/modules/procurement/lib/procurementEntitySearch'
import { remoteSearchFleetResources } from '../lib/fleetResourceSearch'
import {
  formatVehicleResourceLabel,
  readVehiclePlateFromResourceRow,
} from '../lib/vehicleResourceLabel'
import { useTaxiFleetSettings } from './useTaxiFleetSettings'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

type Props = {
  value: string[]
  onChange: (next: string[]) => void
  disabled?: boolean
}

async function resolveFleetVehicleLabel(id: string): Promise<string> {
  const call = await apiCall<{ items?: Record<string, unknown>[] }>(
    `/api/resources/resources?ids=${encodeURIComponent(id)}&pageSize=1`,
  )
  const row = call.result?.items?.[0]
  if (!row || typeof row !== 'object') return id
  const name =
    typeof row.name === 'string' && row.name.trim()
      ? row.name.trim()
      : typeof row.title === 'string' && row.title.trim()
        ? row.title.trim()
        : null
  const plate = readVehiclePlateFromResourceRow(row)
  return formatVehicleResourceLabel(name, plate) || id
}

export function DefaultResourcesField({ value, onChange, disabled = false }: Props) {
  const t = useT()
  const { resourceTypeId } = useTaxiFleetSettings()
  const [pickerValue, setPickerValue] = React.useState('')
  const [labels, setLabels] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    let cancelled = false
    const missing = value.filter((id) => id && !labels[id])
    if (!missing.length) return
    void Promise.all(
      missing.map(async (id) => {
        const resolved = await resolveFleetVehicleLabel(id)
        return [id, resolved] as const
      }),
    ).then((rows) => {
      if (cancelled) return
      setLabels((current) => {
        const next = { ...current }
        for (const [id, label] of rows) next[id] = label
        return next
      })
    })
    return () => {
      cancelled = true
    }
  }, [labels, value])

  function addResource(id: string) {
    const trimmed = id.trim()
    if (!trimmed) return
    if (value.includes(trimmed)) {
      setPickerValue('')
      return
    }
    onChange([...value, trimmed])
    setPickerValue('')
  }

  function removeResource(id: string) {
    onChange(value.filter((item) => item !== id))
  }

  return (
    <div className="w-full min-w-0 space-y-2">
      {value.length ? (
        <ul className="w-full space-y-1.5">
          {value.map((id) => (
            <li
              key={id}
              className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
            >
              <span className="min-w-0 truncate">{labels[id] ?? id}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-1.5"
                disabled={disabled}
                onClick={() => removeResource(id)}
                aria-label={t('taxi_fleet.drivers.defaultVehicles.remove', 'Remove vehicle')}
              >
                <X className="size-3.5" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t(
            'taxi_fleet.drivers.defaultVehicles.empty',
            'No default vehicles yet. Add vehicles the driver may use when starting a shift.',
          )}
        </p>
      )}
      <EntitySearchCombobox
        value={pickerValue}
        onChange={(next) => {
          if (next) addResource(next)
          else setPickerValue('')
        }}
        disabled={disabled}
        className="w-full min-w-0"
        options={mergeEntitySearchOption([], pickerValue, '')}
        onRemoteSearch={async (query) => {
          const rows = await remoteSearchFleetResources(query, resourceTypeId)
          return rows.filter((row) => !value.includes(row.value))
        }}
        placeholder={t('taxi_fleet.drivers.defaultVehicles.add', 'Add vehicle…')}
        searchPlaceholder={t('taxi_fleet.drivers.vehicleSearch', 'Search vehicle…')}
        emptyText={t('taxi_fleet.drivers.vehicleEmpty', 'No vehicles found.')}
      />
    </div>
  )
}
