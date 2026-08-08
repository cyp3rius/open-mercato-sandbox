'use client'

import * as React from 'react'
import { DriverVehicleSearchField } from './DriverVehicleSearchField'
import { ResourceSearchField } from './ResourceSearchField'
import { parseDateTimeLocalValue } from '../lib/datetimeLocal'
import { resolveDriverAssignmentPrefill } from '../lib/driverAssignmentVehicles'
import { resolveResourceTaxiVehicleCategory } from '../lib/resolveResourceTaxiVehicleCategory'
import type { VehicleCategory } from '../lib/pricing/types'
import { useTaxiFleetSettings } from './useTaxiFleetSettings'

type TripVehicleFieldProps = {
  teamMemberId: string
  startedAtLocal: string
  endedAtLocal: string
  value: string
  onChange: (next: string) => void
  onVehicleCategoryChange?: (category: VehicleCategory | '') => void
  disabled?: boolean
  seedResourceId?: string | null
  onAssignmentResolved?: (assignmentId: string | null) => void
}

export function TripVehicleField({
  teamMemberId,
  startedAtLocal,
  endedAtLocal,
  value,
  onChange,
  onVehicleCategoryChange,
  disabled = false,
  onAssignmentResolved,
}: TripVehicleFieldProps) {
  const { resourceTypeId } = useTaxiFleetSettings()
  const prefillKeyRef = React.useRef('')
  const vehicleTouchedRef = React.useRef(false)
  const previousDriverRef = React.useRef('')
  const categoryRequestRef = React.useRef(0)

  React.useEffect(() => {
    if (previousDriverRef.current !== teamMemberId) {
      vehicleTouchedRef.current = false
      previousDriverRef.current = teamMemberId
      prefillKeyRef.current = ''
    }
  }, [teamMemberId])

  React.useEffect(() => {
    const trimmedMemberId = teamMemberId.trim()
    const startedAt = parseDateTimeLocalValue(startedAtLocal)
    const endedAt = parseDateTimeLocalValue(endedAtLocal)
    if (!trimmedMemberId || !startedAt || !endedAt || endedAt <= startedAt) {
      onAssignmentResolved?.(null)
      return
    }

    const prefillKey = `${trimmedMemberId}:${startedAtLocal}:${endedAtLocal}`
    if (prefillKeyRef.current === prefillKey) return

    let cancelled = false
    void resolveDriverAssignmentPrefill(trimmedMemberId, startedAt, endedAt, resourceTypeId).then((prefill) => {
      if (cancelled) return
      prefillKeyRef.current = prefillKey
      if (prefill) {
        onAssignmentResolved?.(prefill.assignmentId)
        if (!vehicleTouchedRef.current) {
          onChange(prefill.resourceId)
        }
        return
      }
      onAssignmentResolved?.(null)
    })
    return () => {
      cancelled = true
    }
  }, [endedAtLocal, onAssignmentResolved, onChange, resourceTypeId, startedAtLocal, teamMemberId])

  React.useEffect(() => {
    if (!onVehicleCategoryChange) return
    const resourceId = value.trim()
    if (!resourceId) {
      onVehicleCategoryChange('')
      return
    }

    const requestId = ++categoryRequestRef.current
    let cancelled = false
    void resolveResourceTaxiVehicleCategory(resourceId).then((category) => {
      if (cancelled || requestId !== categoryRequestRef.current) return
      onVehicleCategoryChange(category ?? '')
    })
    return () => {
      cancelled = true
    }
  }, [onVehicleCategoryChange, value])

  const handleChange = React.useCallback(
    (next: string) => {
      vehicleTouchedRef.current = true
      onChange(next)
    },
    [onChange],
  )

  if (!teamMemberId.trim()) {
    return <ResourceSearchField value={value} onChange={handleChange} disabled={disabled} />
  }

  return (
    <DriverVehicleSearchField
      teamMemberId={teamMemberId}
      startedAtLocal={startedAtLocal}
      endedAtLocal={endedAtLocal}
      value={value}
      onChange={handleChange}
      disabled={disabled}
      fallbackToAllResources
    />
  )
}
