'use client'

import * as React from 'react'
import { TripLocationInput, useTripAirportSuggestions } from './TripLocationInput'

type TripRouteAddressFieldProps = {
  value: string
  onChange: (value: string) => void
  onCoordsChange: (lon: string, lat: string) => void
  disabled?: boolean
  placeholder?: string
  airportDefaults?: boolean
}

export function TripRouteAddressField({
  value,
  onChange,
  onCoordsChange,
  disabled = false,
  placeholder,
  airportDefaults = false,
}: TripRouteAddressFieldProps) {
  const airportSuggestions = useTripAirportSuggestions()

  return (
    <TripLocationInput
      value={value}
      onChange={(next, meta) => {
        onChange(next)
        onCoordsChange(
          meta?.lon != null ? String(meta.lon) : '',
          meta?.lat != null ? String(meta.lat) : '',
        )
      }}
      disabled={disabled}
      placeholder={placeholder}
      defaultSuggestions={airportDefaults ? airportSuggestions : undefined}
    />
  )
}
