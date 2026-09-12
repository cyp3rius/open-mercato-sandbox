'use client'

import React from 'react'
import { Loader2, LocateFixed, MapPin, Plus, RefreshCw, X } from 'lucide-react'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import type { DriverPlace } from '../../lib/driverOffline/tripTypes'
import { endsDistanceKm, formatCoordAddress } from '../../lib/driverOffline/tripTypes'
import { DriverDateTimeField } from './DriverDateTimeField'
import {
  driverFieldClass,
  driverLabelClass,
  driverMutedTextClass,
  driverSecondaryActionClass,
} from './driverUi'

type Suggestion = { label: string; lon?: number; lat?: number }

type PlaceFieldProps = {
  id: string
  label: string
  value: DriverPlace
  disabled?: boolean
  onChange: (next: DriverPlace) => void
  onGeoError?: (message: string) => void
}

function hasResolvedCoordinates(place: DriverPlace): boolean {
  return (
    typeof place.lat === 'number' &&
    Number.isFinite(place.lat) &&
    typeof place.lon === 'number' &&
    Number.isFinite(place.lon)
  )
}

function PlaceField({ id, label, value, disabled, onChange, onGeoError }: PlaceFieldProps) {
  const t = useT()
  const locale = useLocale()
  const [query, setQuery] = React.useState(value.address)
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([])
  const [loading, setLoading] = React.useState(false)
  const [geoBusy, setGeoBusy] = React.useState(false)
  const skipSuggestionsRef = React.useRef(hasResolvedCoordinates(value))

  React.useEffect(() => {
    setQuery(value.address)
    if (hasResolvedCoordinates(value)) {
      skipSuggestionsRef.current = true
      setSuggestions([])
      setLoading(false)
    }
  }, [value.address, value.lat, value.lon])

  React.useEffect(() => {
    if (skipSuggestionsRef.current) {
      skipSuggestionsRef.current = false
      setSuggestions([])
      setLoading(false)
      return
    }
    // Committed selection (coords present, text unchanged) — e.g. return to this step.
    if (hasResolvedCoordinates(value) && query.trim() === value.address.trim()) {
      setSuggestions([])
      setLoading(false)
      return
    }
    if (query.trim().length < 3) {
      setSuggestions([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      void apiCall<{ suggestions?: Suggestion[] }>(
        `/api/taxi_fleet/route/places-autocomplete?input=${encodeURIComponent(query)}&lang=${locale === 'en' ? 'en' : 'pl'}`,
      )
        .then(({ result }) => {
          if (cancelled) return
          setSuggestions(Array.isArray(result?.suggestions) ? result.suggestions : [])
        })
        .catch(() => {
          if (!cancelled) setSuggestions([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 450)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, locale, value.address, value.lat, value.lon])

  async function useMyLocation() {
    if (!navigator.geolocation) {
      onGeoError?.(t('taxi_fleet.driverApp.trips.geoUnsupported', 'Geolocation is not available.'))
      return
    }
    setGeoBusy(true)
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
        })
      })
      const lat = position.coords.latitude
      const lon = position.coords.longitude
      try {
        const { result } = await apiCall<{ address?: string }>(
          `/api/taxi_fleet/route/reverse-geocode?lat=${lat}&lng=${lon}&lang=${locale === 'en' ? 'en' : 'pl'}`,
        )
        skipSuggestionsRef.current = true
        setSuggestions([])
        onChange({
          address: result?.address?.trim() || formatCoordAddress(lat, lon),
          lat,
          lon,
        })
      } catch {
        skipSuggestionsRef.current = true
        setSuggestions([])
        onChange({ address: formatCoordAddress(lat, lon), lat, lon })
      }
    } catch {
      onGeoError?.(t('taxi_fleet.driverApp.trips.geoFailed', 'Could not read current location.'))
    } finally {
      setGeoBusy(false)
    }
  }

  return (
    <div>
      <label htmlFor={id} className={driverLabelClass}>
        {label}
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            value={query}
            disabled={disabled}
            onChange={(event) => {
              skipSuggestionsRef.current = false
              setQuery(event.target.value)
              onChange({ address: event.target.value, lat: null, lon: null })
            }}
            className={driverFieldClass}
            autoComplete="off"
          />
          {loading ? (
            <Loader2 className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-[#99A1B7]" />
          ) : (
            <MapPin className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-[#99A1B7]" />
          )}
          {suggestions.length > 0 ? (
            <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border border-[#DBDFE9] bg-white shadow-md">
              {suggestions.map((item) => (
                <li key={`${item.label}-${item.lat}-${item.lon}`}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-[#071437] hover:bg-[#F9F9F9]"
                    onClick={() => {
                      skipSuggestionsRef.current = true
                      setQuery(item.label)
                      setSuggestions([])
                      setLoading(false)
                      onChange({
                        address: item.label,
                        lat: typeof item.lat === 'number' ? item.lat : null,
                        lon: typeof item.lon === 'number' ? item.lon : null,
                      })
                    }}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <Button
          type="button"
          disabled={disabled || geoBusy}
          aria-label={t('taxi_fleet.driverApp.trips.useMyLocation', 'Use my location')}
          onClick={() => void useMyLocation()}
          className={`${driverSecondaryActionClass} w-11 shrink-0 px-0`}
        >
          {geoBusy ? <Loader2 className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}
        </Button>
      </div>
    </div>
  )
}

export type DriverRouteStepValue = {
  from: DriverPlace
  to: DriverPlace
  waypoints: DriverPlace[]
  startedAtLocal: string
  endedAtLocal: string
  distanceKm: string
  durationText: string
}

type DriverRouteStepProps = {
  value: DriverRouteStepValue
  disabled?: boolean
  requireEndedAt?: boolean
  onChange: (next: DriverRouteStepValue) => void
  onError?: (message: string) => void
}

export function DriverRouteStep({
  value,
  disabled,
  requireEndedAt = true,
  onChange,
  onError,
}: DriverRouteStepProps) {
  const t = useT()
  const locale = useLocale()
  const [distanceBusy, setDistanceBusy] = React.useState(false)

  async function recalculateDistance(next = value) {
    const stops = [next.from, ...next.waypoints, next.to]
      .map((place) => ({
        address: place.address.trim(),
        lat: place.lat ?? undefined,
        lon: place.lon ?? undefined,
      }))
      .filter((stop) => stop.address.length > 0)
    if (stops.length < 2) return
    setDistanceBusy(true)
    try {
      const { result } = await apiCall<{
        distanceKm?: number
        durationText?: string
      }>('/api/taxi_fleet/route/distance', {
        method: 'POST',
        body: JSON.stringify({ stops, lang: locale === 'en' ? 'en' : 'pl' }),
      })
      if (typeof result?.distanceKm === 'number') {
        onChange({
          ...next,
          distanceKm: result.distanceKm.toFixed(2),
          durationText: result.durationText || next.durationText,
        })
        return
      }
    } catch {
      const fallback = endsDistanceKm(next.from, next.to)
      if (fallback != null) {
        onChange({ ...next, distanceKm: fallback.toFixed(2) })
        return
      }
      onError?.(t('taxi_fleet.driverApp.trips.distanceFailed', 'Could not calculate distance.'))
    } finally {
      setDistanceBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <PlaceField
        id="fromAddress"
        label={t('taxi_fleet.driverApp.trips.from', 'From')}
        value={value.from}
        disabled={disabled}
        onChange={(from) => onChange({ ...value, from })}
        onGeoError={onError}
      />
      {value.waypoints.map((waypoint, index) => (
        <div key={`wp-${index}`} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <PlaceField
              id={`waypoint-${index}`}
              label={t('taxi_fleet.driverApp.trips.waypoint', 'Via {n}', { n: String(index + 1) })}
              value={waypoint}
              disabled={disabled}
              onChange={(nextWp) => {
                const waypoints = [...value.waypoints]
                waypoints[index] = nextWp
                onChange({ ...value, waypoints })
              }}
              onGeoError={onError}
            />
          </div>
          <Button
            type="button"
            disabled={disabled}
            aria-label={t('taxi_fleet.driverApp.trips.removeWaypoint', 'Remove stop')}
            onClick={() =>
              onChange({
                ...value,
                waypoints: value.waypoints.filter((_, i) => i !== index),
              })
            }
            className={`${driverSecondaryActionClass} mb-0.5 w-11 shrink-0 px-0`}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        disabled={disabled || value.waypoints.length >= 5}
        className={`${driverSecondaryActionClass} gap-1.5`}
        onClick={() => onChange({ ...value, waypoints: [...value.waypoints, { address: '', lat: null, lon: null }] })}
      >
        <Plus className="size-4" aria-hidden />
        {t('taxi_fleet.driverApp.trips.addWaypoint', 'Add stop')}
      </Button>
      <PlaceField
        id="toAddress"
        label={t('taxi_fleet.driverApp.trips.to', 'To')}
        value={value.to}
        disabled={disabled}
        onChange={(to) => onChange({ ...value, to })}
        onGeoError={onError}
      />

      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <DriverDateTimeField
          id="startedAt"
          label={t('taxi_fleet.driverApp.trips.startedAt', 'Started at')}
          value={value.startedAtLocal}
          disabled={disabled}
          onChange={(startedAtLocal) => onChange({ ...value, startedAtLocal })}
        />
        {requireEndedAt ? (
          <DriverDateTimeField
            id="endedAt"
            label={t('taxi_fleet.driverApp.trips.endedAt', 'Ended at')}
            value={value.endedAtLocal}
            disabled={disabled}
            onChange={(endedAtLocal) => onChange({ ...value, endedAtLocal })}
          />
        ) : null}
      </div>

      <div>
        <label htmlFor="distanceKm" className={driverLabelClass}>
          {t('taxi_fleet.driverApp.trips.distance', 'Distance')}
        </label>
        <div className="flex gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <input
              id="distanceKm"
              type="text"
              inputMode="decimal"
              disabled={disabled}
              value={value.distanceKm}
              onChange={(event) => onChange({ ...value, distanceKm: event.target.value })}
              className={`${driverFieldClass} min-w-0 flex-1 tabular-nums`}
            />
            <span className={`shrink-0 ${driverMutedTextClass}`}>
              {t('taxi_fleet.driverApp.trips.unitKm', 'km')}
            </span>
          </div>
          <Button
            type="button"
            disabled={disabled || distanceBusy}
            className={`${driverSecondaryActionClass} w-auto shrink-0 gap-1.5 px-3`}
            onClick={() => void recalculateDistance()}
          >
            {distanceBusy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
            {distanceBusy
              ? t('taxi_fleet.driverApp.trips.calculating', 'Calculating…')
              : t('taxi_fleet.driverApp.trips.recalculate', 'Recalculate')}
          </Button>
        </div>
        {value.durationText ? (
          <p className={`mt-1 ${driverMutedTextClass}`}>
            {t('taxi_fleet.driverApp.trips.duration', 'Duration')}: {value.durationText}
          </p>
        ) : null}
      </div>
    </div>
  )
}
