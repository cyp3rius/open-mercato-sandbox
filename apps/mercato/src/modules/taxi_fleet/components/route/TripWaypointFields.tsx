'use client'

import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { TripLocationInput, type PlaceSelectionMeta } from './TripLocationInput'
import type { RouteWaypointMeta } from '../../lib/route/routeDistance'

type WaypointRow = {
  id: string
  address: string
  lon?: number
  lat?: number
}

function rowsFromMeta(meta: RouteWaypointMeta[]): WaypointRow[] {
  return meta.map((waypoint, index) => ({
    id: `waypoint-${index}-${waypoint.address.slice(0, 12)}`,
    address: waypoint.address,
    lon: waypoint.lon,
    lat: waypoint.lat,
  }))
}

function rowsFromAddresses(addresses: string[]): WaypointRow[] {
  return addresses.map((address, index) => ({
    id: `waypoint-${index}-${address.slice(0, 12)}`,
    address,
  }))
}

function serializeWaypointMeta(rows: WaypointRow[]): RouteWaypointMeta[] {
  return rows
    .filter((row) => row.address.trim().length > 0)
    .map((row) => ({
      address: row.address.trim(),
      ...(row.lon != null && row.lat != null ? { lon: row.lon, lat: row.lat } : {}),
    }))
}

type TripWaypointFieldsProps = {
  value: string
  metaJson: string
  onChange: (addresses: string, metaJson: string) => void
  disabled?: boolean
}

export function TripWaypointFields({ value, metaJson, onChange, disabled = false }: TripWaypointFieldsProps) {
  const t = useT()
  const nextIdRef = React.useRef(0)

  const [rows, setRows] = React.useState<WaypointRow[]>(() => {
    if (metaJson.trim()) {
      try {
        const parsed = JSON.parse(metaJson) as RouteWaypointMeta[]
        if (Array.isArray(parsed) && parsed.length) {
          return rowsFromMeta(parsed)
        }
      } catch {
        // fall through
      }
    }
    const addresses = value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    return addresses.length ? rowsFromAddresses(addresses) : []
  })

  const syncRows = React.useCallback(
    (nextRows: WaypointRow[]) => {
      setRows(nextRows)
      const addresses = nextRows.map((row) => row.address.trim()).filter(Boolean)
      onChange(addresses.join('\n'), JSON.stringify(serializeWaypointMeta(nextRows)))
    },
    [onChange],
  )

  const addWaypoint = () => {
    nextIdRef.current += 1
    syncRows([...rows, { id: `waypoint-new-${nextIdRef.current}`, address: '' }])
  }

  const removeWaypoint = (id: string) => {
    syncRows(rows.filter((row) => row.id !== id))
  }

  const updateWaypoint = (id: string, address: string, meta?: PlaceSelectionMeta) => {
    syncRows(
      rows.map((row) =>
        row.id === id
          ? {
              ...row,
              address,
              lon: meta?.lon,
              lat: meta?.lat,
            }
          : row,
      ),
    )
  }

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={row.id} className="flex items-start gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-sm font-medium">
              {t('taxi_fleet.trips.form.waypointLabel', 'Stop {index}', { index: index + 1 })}
            </div>
            <TripLocationInput
              value={row.address}
              onChange={(next, meta) => updateWaypoint(row.id, next, meta)}
              disabled={disabled}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-6 size-8 shrink-0 text-muted-foreground hover:text-destructive"
            aria-label={t('taxi_fleet.trips.form.removeWaypoint', 'Remove stop')}
            disabled={disabled}
            onClick={() => removeWaypoint(row.id)}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={addWaypoint}>
        <Plus className="mr-2 size-4" aria-hidden />
        {t('taxi_fleet.trips.form.addWaypoint', 'Add stop')}
      </Button>
    </div>
  )
}
