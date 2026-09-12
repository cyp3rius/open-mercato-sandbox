'use client'

import * as React from 'react'
import { Loader2, LocateFixed, MapPin, Plane } from 'lucide-react'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { readApiResultOrThrow, apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { getAirportSuggestions } from '../../lib/route/fleetAirports'
import type { PlaceSuggestion } from '../../lib/route/placesAutocomplete'
import type { RouteLocale } from '../../lib/route/openRouteService'

const EMPTY_SUGGESTIONS: PlaceSuggestion[] = []
const AUTOCOMPLETE_DEBOUNCE_MS = 600

export type PlaceSelectionMeta = {
  lon?: number
  lat?: number
  placeId?: string
}

type TripLocationInputProps = {
  value: string
  onChange: (value: string, meta?: PlaceSelectionMeta) => void
  disabled?: boolean
  placeholder?: string
  id?: string
  defaultSuggestions?: PlaceSuggestion[]
  airportOnly?: boolean
  onGeoError?: (message: string) => void
}

function resolveRouteLocale(locale: string): RouteLocale {
  return locale === 'en' ? 'en' : 'pl'
}

export function TripLocationInput({
  value,
  onChange,
  disabled = false,
  placeholder,
  id: idProp,
  defaultSuggestions = EMPTY_SUGGESTIONS,
  airportOnly = false,
  onGeoError,
}: TripLocationInputProps) {
  const t = useT()
  const appLocale = useLocale()
  const routeLocale = resolveRouteLocale(appLocale)

  const generatedId = React.useId()
  const inputId = idProp ?? generatedId
  const listboxId = `${inputId}-suggestions`

  const [locating, setLocating] = React.useState(false)
  const [fetching, setFetching] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(-1)
  const [suggestions, setSuggestions] = React.useState<PlaceSuggestion[]>([])

  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const blurTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const abortRef = React.useRef<AbortController | null>(null)
  const requestIdRef = React.useRef(0)
  const skipFetchRef = React.useRef(false)
  const isFocusedRef = React.useRef(false)

  const showDefaultSuggestions = React.useCallback(() => {
    if (!isFocusedRef.current || value.trim().length > 0 || defaultSuggestions.length === 0) {
      return
    }
    setSuggestions(defaultSuggestions)
    setOpen(true)
    setActiveIndex(-1)
  }, [defaultSuggestions, value])

  const clearScheduledAutocomplete = React.useCallback(() => {
    clearTimeout(debounceRef.current)
  }, [])

  const cancelAutocomplete = React.useCallback(() => {
    clearScheduledAutocomplete()
    abortRef.current?.abort()
    abortRef.current = null
  }, [clearScheduledAutocomplete])

  React.useEffect(() => () => {
    cancelAutocomplete()
    clearTimeout(blurTimeoutRef.current)
  }, [cancelAutocomplete])

  const fetchSuggestions = React.useCallback(
    async (query: string) => {
      abortRef.current?.abort()

      const requestId = ++requestIdRef.current
      const controller = new AbortController()
      abortRef.current = controller

      setFetching(true)
      try {
        const params = new URLSearchParams({
          input: query,
          lang: routeLocale,
        })
        if (airportOnly) params.set('filter', 'airport')

        const call = await apiCall<{ suggestions?: PlaceSuggestion[] }>(
          `/api/taxi_fleet/route/places-autocomplete?${params}`,
          { signal: controller.signal },
          { fallback: { suggestions: [] } },
        )

        if (requestId !== requestIdRef.current) return

        if (!call.ok) {
          setSuggestions([])
          setOpen(false)
          return
        }

        const data = call.result ?? { suggestions: [] }
        const next = Array.isArray(data.suggestions) ? data.suggestions : []
        setSuggestions(next)
        setOpen(isFocusedRef.current && next.length > 0)
        setActiveIndex(-1)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        if (requestId !== requestIdRef.current) return
        setSuggestions([])
        setOpen(false)
      } finally {
        if (requestId === requestIdRef.current) {
          setFetching(false)
          abortRef.current = null
        }
      }
    },
    [airportOnly, routeLocale],
  )

  const scheduleAutocomplete = React.useCallback(
    (query: string) => {
      clearScheduledAutocomplete()

      if (query.length < 2) {
        setFetching(false)
        setSuggestions([])
        setOpen(false)
        setActiveIndex(-1)
        return
      }

      debounceRef.current = setTimeout(() => {
        void fetchSuggestions(query)
      }, AUTOCOMPLETE_DEBOUNCE_MS)
    },
    [clearScheduledAutocomplete, fetchSuggestions],
  )

  const handleInputChange = (nextValue: string) => {
    onChange(nextValue)

    if (skipFetchRef.current) {
      skipFetchRef.current = false
      return
    }

    scheduleAutocomplete(nextValue.trim())
  }

  const selectSuggestion = (suggestion: PlaceSuggestion) => {
    cancelAutocomplete()
    skipFetchRef.current = true
    onChange(
      suggestion.label,
      suggestion.lon != null && suggestion.lat != null
        ? { lon: suggestion.lon, lat: suggestion.lat, placeId: suggestion.id }
        : undefined,
    )
    setSuggestions([])
    setOpen(false)
    setActiveIndex(-1)
    setFetching(false)
  }

  const handleLocate = () => {
    if (!navigator.geolocation) {
      onGeoError?.(t('taxi_fleet.trips.form.route.geolocationUnsupported', 'Geolocation is not supported in this browser.'))
      return
    }

    setLocating(true)
    setOpen(false)

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords
          const params = new URLSearchParams({
            lat: String(latitude),
            lng: String(longitude),
            lang: routeLocale,
          })
          const data = await readApiResultOrThrow<{ address?: string }>(
            `/api/taxi_fleet/route/reverse-geocode?${params}`,
          )

          if (typeof data.address !== 'string') {
            onGeoError?.(t('taxi_fleet.trips.form.route.geolocationUnavailable', 'Could not resolve your location.'))
            return
          }

          skipFetchRef.current = true
          onChange(data.address, { lon: longitude, lat: latitude })
          setSuggestions([])
        } catch {
          onGeoError?.(t('taxi_fleet.trips.form.route.geolocationUnavailable', 'Could not resolve your location.'))
        } finally {
          setLocating(false)
        }
      },
      (err) => {
        setLocating(false)
        onGeoError?.(
          err.code === err.PERMISSION_DENIED
            ? t('taxi_fleet.trips.form.route.geolocationDenied', 'Location access was denied.')
            : t('taxi_fleet.trips.form.route.geolocationUnavailable', 'Could not resolve your location.'),
        )
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60_000 },
    )
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (index + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1))
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      selectSuggestion(suggestions[activeIndex])
    } else if (event.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  return (
    <div className="relative">
      <input
        id={inputId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
        value={value}
        onChange={(event) => handleInputChange(event.target.value)}
        onFocus={() => {
          clearTimeout(blurTimeoutRef.current)
          isFocusedRef.current = true
          showDefaultSuggestions()
        }}
        onBlur={() => {
          isFocusedRef.current = false
          blurTimeoutRef.current = setTimeout(() => setOpen(false), 150)
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        className={cn(CRUD_FORM_TEXT_INPUT_CLASS, 'pr-12 sm:pr-11')}
        data-crud-focus-target=""
      />

      <div className="pointer-events-none absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
        {fetching && !locating ? (
          <Loader2 className="mr-11 size-4 animate-spin text-muted-foreground sm:mr-9" aria-hidden />
        ) : null}
        <IconButton
          type="button"
          variant="ghost"
          size="lg"
          onMouseDown={(event) => event.preventDefault()}
          onClick={handleLocate}
          disabled={disabled || locating}
          aria-label={
            locating
              ? t('taxi_fleet.trips.form.route.locating', 'Locating…')
              : t('taxi_fleet.trips.form.route.useMyLocation', 'Use my location')
          }
          className="pointer-events-auto size-11 shrink-0 sm:size-9"
        >
          {locating ? (
            <Loader2 className="size-5 animate-spin sm:size-4" aria-hidden />
          ) : (
            <LocateFixed className="size-5 sm:size-4" aria-hidden />
          )}
        </IconButton>
      </div>

      {open && suggestions.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={t('taxi_fleet.trips.form.route.suggestionsLabel', 'Address suggestions')}
          className={cn(
            'absolute z-50 mt-1 max-h-60 w-full overflow-y-auto overflow-hidden rounded-lg border border-border/60',
            'bg-popover text-popover-foreground shadow-lg',
          )}
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectSuggestion(suggestion)}
              className={cn(
                'flex min-h-11 cursor-pointer items-start gap-2.5 px-3 py-2.5 text-sm transition-colors',
                index === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/80',
              )}
            >
              {suggestion.isAirport ? (
                <Plane className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              ) : (
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary/80" aria-hidden />
              )}
              <span className="leading-snug">{suggestion.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function useTripAirportSuggestions(): PlaceSuggestion[] {
  const appLocale = useLocale()
  const routeLocale = resolveRouteLocale(appLocale)
  return React.useMemo(() => getAirportSuggestions(routeLocale), [routeLocale])
}
