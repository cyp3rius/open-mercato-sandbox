'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useLocale, useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { endedAtLocalFromDuration } from '../../lib/datetimeLocal'
import { parseDurationTextToSeconds } from '../../lib/route/openRouteService'
import { buildRouteDistanceStops } from '../../lib/route/routeDistance'

const ROUTE_DISTANCE_DEBOUNCE_MS = 700

type TripRouteDistanceSyncProps = {
  values: Record<string, unknown>
  setFormValue?: (id: string, value: unknown) => void
  disabled?: boolean
}

function resolveRouteLocale(locale: string): 'pl' | 'en' {
  return locale === 'en' ? 'en' : 'pl'
}

function readString(values: Record<string, unknown>, key: string): string {
  const value = values[key]
  return typeof value === 'string' ? value : ''
}

export function buildTripRouteFingerprint(values: Record<string, unknown>): string {
  return JSON.stringify({
    fromAddress: readString(values, 'fromAddress').trim(),
    toAddress: readString(values, 'toAddress').trim(),
    waypointAddresses: readString(values, 'waypointAddresses'),
    fromLon: readString(values, 'fromLon'),
    fromLat: readString(values, 'fromLat'),
    toLon: readString(values, 'toLon'),
    toLat: readString(values, 'toLat'),
    routeWaypointMeta: readString(values, 'routeWaypointMeta'),
  })
}

function applyRouteDurationToEnd(
  setFormValue: (id: string, value: unknown) => void,
  startedAtLocal: string,
  durationSeconds: number,
) {
  const endedAtLocal = endedAtLocalFromDuration(startedAtLocal, durationSeconds)
  if (endedAtLocal) setFormValue('endedAtLocal', endedAtLocal)
}

export function TripRouteDistanceSync({
  values,
  setFormValue,
  disabled = false,
}: TripRouteDistanceSyncProps) {
  const t = useT()
  const appLocale = useLocale()
  const routeLocale = resolveRouteLocale(appLocale)

  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(undefined)
  const abortRef = React.useRef<AbortController | null>(null)
  const requestIdRef = React.useRef(0)
  const startedAtLocalRef = React.useRef('')
  const prevStartedAtLocalRef = React.useRef<string | null>(null)

  const fromAddress = readString(values, 'fromAddress').trim()
  const toAddress = readString(values, 'toAddress').trim()
  const waypointAddresses = readString(values, 'waypointAddresses')
  const fromLon = readString(values, 'fromLon')
  const fromLat = readString(values, 'fromLat')
  const toLon = readString(values, 'toLon')
  const toLat = readString(values, 'toLat')
  const routeWaypointMeta = readString(values, 'routeWaypointMeta')
  const startedAtLocal = readString(values, 'startedAtLocal')
  const routeDurationSecondsRaw = readString(values, 'routeDurationSeconds')
  const routeSyncedFingerprint = readString(values, 'routeSyncedFingerprint')

  startedAtLocalRef.current = startedAtLocal

  const routeFingerprint = React.useMemo(
    () =>
      buildTripRouteFingerprint({
        fromAddress,
        toAddress,
        waypointAddresses,
        fromLon,
        fromLat,
        toLon,
        toLat,
        routeWaypointMeta,
      }),
    [fromAddress, fromLat, fromLon, routeWaypointMeta, toAddress, toLat, toLon, waypointAddresses],
  )

  const shouldCalculateRoute =
    Boolean(fromAddress && toAddress) && routeFingerprint !== routeSyncedFingerprint

  React.useEffect(() => {
    if (!setFormValue || disabled || !shouldCalculateRoute) {
      if (!shouldCalculateRoute) {
        setLoading(false)
        setError(null)
      }
      return
    }

    clearTimeout(debounceRef.current)
    abortRef.current?.abort()

    const fingerprintForRequest = routeFingerprint

    debounceRef.current = setTimeout(() => {
      const requestId = ++requestIdRef.current
      const controller = new AbortController()
      abortRef.current = controller

      const stops = buildRouteDistanceStops({
        fromAddress,
        fromLon,
        fromLat,
        toAddress,
        toLon,
        toLat,
        waypointAddresses,
        routeWaypointMeta,
      })

      if (stops.length < 2) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      void (async () => {
        try {
          const call = await apiCall<{
            distanceKm?: number
            durationText?: string
            durationSeconds?: number
            error?: string
          }>(
            '/api/taxi_fleet/route/distance',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stops, lang: routeLocale }),
              signal: controller.signal,
            },
            { fallback: {} },
          )

          if (requestId !== requestIdRef.current) return

          const data = call.result ?? {}
          if (!call.ok || typeof data.distanceKm !== 'number') {
            setError(data.error ?? t('taxi_fleet.trips.form.route.distanceError', 'Could not calculate route.'))
            return
          }

          const durationSeconds =
            typeof data.durationSeconds === 'number' && Number.isFinite(data.durationSeconds)
              ? Math.max(0, Math.round(data.durationSeconds))
              : parseDurationTextToSeconds(typeof data.durationText === 'string' ? data.durationText : '')

          setFormValue('distanceKm', String(data.distanceKm))
          setFormValue('durationText', typeof data.durationText === 'string' ? data.durationText : '')
          setFormValue('routeSyncedFingerprint', fingerprintForRequest)
          if (durationSeconds != null && durationSeconds > 0) {
            setFormValue('routeDurationSeconds', String(durationSeconds))
            applyRouteDurationToEnd(setFormValue, startedAtLocalRef.current, durationSeconds)
          } else {
            setFormValue('routeDurationSeconds', '')
          }
          setError(null)
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return
          if (requestId !== requestIdRef.current) return
          setError(t('taxi_fleet.trips.form.route.distanceError', 'Could not calculate route.'))
        } finally {
          if (requestId === requestIdRef.current) {
            setLoading(false)
            abortRef.current = null
          }
        }
      })()
    }, ROUTE_DISTANCE_DEBOUNCE_MS)

    return () => {
      clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [
    disabled,
    fromAddress,
    fromLat,
    fromLon,
    routeFingerprint,
    routeLocale,
    routeWaypointMeta,
    setFormValue,
    shouldCalculateRoute,
    t,
    toAddress,
    toLat,
    toLon,
    waypointAddresses,
  ])

  React.useEffect(() => {
    if (!setFormValue || disabled) return
    if (prevStartedAtLocalRef.current === null) {
      prevStartedAtLocalRef.current = startedAtLocal
      return
    }
    if (prevStartedAtLocalRef.current === startedAtLocal) return
    prevStartedAtLocalRef.current = startedAtLocal

    const durationSeconds = Number(routeDurationSecondsRaw)
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return
    applyRouteDurationToEnd(setFormValue, startedAtLocal, durationSeconds)
  }, [disabled, routeDurationSecondsRaw, setFormValue, startedAtLocal])

  if (!loading && !error) return null

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {loading ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
      {loading ? t('taxi_fleet.trips.form.route.calculating', 'Calculating route…') : null}
      {error ? <span className="text-destructive">{error}</span> : null}
    </div>
  )
}
