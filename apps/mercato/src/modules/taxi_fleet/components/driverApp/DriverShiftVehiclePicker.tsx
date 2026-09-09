'use client'

import React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { buildShiftStartAllowlist, preselectShiftVehicleId } from '../../lib/driverDefaultResources'
import { formatVehicleResourceLabel, stripPlateFromVehicleName } from '../../lib/vehicleResourceLabel'
import { driverMutedTextClass } from './driverUi'

export type DriverDefaultVehicleOption = {
  id: string
  label: string
  name?: string | null
  plate?: string | null
  /** False when another assignment already holds this vehicle today. */
  available?: boolean
}

type AssignmentVehicleSeed = {
  resourceId: string
  resourceLabel?: string | null
  resourceName?: string | null
  resourcePlate?: string | null
} | null

type Props = {
  vehicles: DriverDefaultVehicleOption[]
  assignmentResourceId?: string | null
  value: string | null
  onChange: (resourceId: string) => void
  disabled?: boolean
}

/** Profile defaults that are free for today (own assignment vehicle counts as free). */
export function buildShiftVehicleOptions(input: {
  defaults: DriverDefaultVehicleOption[]
  assignment?: AssignmentVehicleSeed
}): DriverDefaultVehicleOption[] {
  const availableDefaults = input.defaults.filter((v) => v.available !== false)
  const allowlist = buildShiftStartAllowlist({
    defaultResourceIds: availableDefaults.map((v) => v.id),
  })
  const byId = new Map(input.defaults.map((v) => [v.id, v]))
  if (input.assignment?.resourceId && allowlist.includes(input.assignment.resourceId)) {
    const existing = byId.get(input.assignment.resourceId)
    const name =
      stripPlateFromVehicleName(
        input.assignment.resourceName ?? existing?.name ?? input.assignment.resourceLabel ?? existing?.label,
        input.assignment.resourcePlate ?? existing?.plate,
      ) || null
    const plate = input.assignment.resourcePlate?.trim() || existing?.plate?.trim() || null
    const label = formatVehicleResourceLabel(name, plate) || input.assignment.resourceId
    byId.set(input.assignment.resourceId, {
      id: input.assignment.resourceId,
      label,
      name,
      plate,
      available: true,
    })
  }
  return allowlist.map((id) => {
    const existing = byId.get(id)
    if (!existing) return { id, label: id, name: null, plate: null, available: true }
    const name = stripPlateFromVehicleName(existing.name ?? existing.label, existing.plate) || null
    const plate = existing.plate?.trim() || null
    return {
      id,
      label: formatVehicleResourceLabel(name, plate) || id,
      name,
      plate,
      available: true,
    }
  })
}

export function useShiftVehicleSelection(
  vehicles: DriverDefaultVehicleOption[] | undefined | null,
  assignmentResourceId?: string | null,
) {
  const ids = React.useMemo(() => (vehicles ?? []).map((v) => v.id), [vehicles])
  const idsKey = ids.join(',')
  const [selectedResourceId, setSelectedResourceId] = React.useState<string | null>(() =>
    preselectShiftVehicleId(ids, assignmentResourceId),
  )

  React.useEffect(() => {
    setSelectedResourceId(preselectShiftVehicleId(ids, assignmentResourceId))
  }, [assignmentResourceId, ids, idsKey])

  return {
    defaultVehicles: vehicles ?? [],
    selectedResourceId,
    setSelectedResourceId,
    needsVehiclePick: ids.length > 0,
  }
}

function vehicleDisplayParts(vehicle: DriverDefaultVehicleOption): {
  name: string | null
  plate: string | null
  singleLine: string
} {
  const plate = vehicle.plate?.trim() || null
  const rawName = vehicle.name?.trim() || vehicle.label?.trim() || null
  const name = stripPlateFromVehicleName(rawName, plate) || null
  const singleLine = formatVehicleResourceLabel(name, plate) || vehicle.id
  return { name, plate, singleLine }
}

export function DriverShiftVehiclePicker({
  vehicles,
  assignmentResourceId,
  value,
  onChange,
  disabled = false,
}: Props) {
  const t = useT()
  if (!vehicles.length) return null

  const selected =
    value ??
    preselectShiftVehicleId(
      vehicles.map((v) => v.id),
      assignmentResourceId,
    )

  return (
    <fieldset className="w-full min-w-0 space-y-2" disabled={disabled}>
      <legend className={`px-0.5 text-xs font-medium ${driverMutedTextClass}`}>
        {t('taxi_fleet.driverApp.shift.selectVehicle', 'Confirm vehicle for this shift')}
      </legend>
      <div
        className="w-full space-y-2"
        role="radiogroup"
        aria-label={t('taxi_fleet.driverApp.shift.selectVehicle', 'Confirm vehicle for this shift')}
      >
        {vehicles.map((vehicle) => {
          const { name, plate, singleLine } = vehicleDisplayParts(vehicle)
          const checked = selected === vehicle.id
          return (
            <label
              key={vehicle.id}
              className={`flex w-full cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${
                checked ? 'border-[#1B84FF] bg-[#F1F6FF]' : 'border-[#F1F1F4] bg-[#F9F9F9]'
              } ${disabled ? 'opacity-60' : ''}`}
            >
              <input
                type="radio"
                name="driver-shift-vehicle"
                className="mt-1"
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(vehicle.id)}
              />
              <span className="min-w-0 flex-1">
                {name && plate ? (
                  <>
                    <span className="block truncate text-sm font-semibold text-[#071437]">{name}</span>
                    <span className="block truncate text-xs font-medium text-[#4B5675]">
                      {t('taxi_fleet.driverApp.vehiclePlate', 'Plate')}: {plate}
                    </span>
                  </>
                ) : (
                  <span className="block truncate text-sm font-semibold text-[#071437]">{singleLine}</span>
                )}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
