'use client'

import React from 'react'
import { enqueueDriverMutation } from '../../lib/driverOffline/outbox'
import { aggregateGpsDistanceKm, formatGpsDistanceKm } from '../../lib/assignmentGpsDistance'
import { useDriverOnlineStatus } from './useDriverOnlineStatus'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

export type DriverLocationPingInput = {
  recordedAt: string
  lat: number
  lon: number
  accuracyM?: number | null
  speedMps?: number | null
  heading?: number | null
  assignmentId?: string | null
  tripId?: string | null
}

type Options = {
  enabled: boolean
  assignmentId?: string | null
}

const FLUSH_MS = 30_000
const MAX_BATCH = 50

type BufferState = {
  pings: DriverLocationPingInput[]
  /** Points already flushed this session (for local km estimate). */
  sessionPoints: Array<{ lat: number; lon: number; recordedAt: string; accuracyM?: number | null }>
  assignmentId: string | null
  online: boolean
}

const buffer: BufferState = {
  pings: [],
  sessionPoints: [],
  assignmentId: null,
  online: true,
}

let flushImpl: (() => Promise<void>) | null = null
const listeners = new Set<() => void>()
/** When live trip (or another screen) owns geolocation, shell watch skips pushes. */
let externalLocationFeed = false

function notifyListeners() {
  for (const listener of listeners) listener()
}

function pushToBuffer(ping: DriverLocationPingInput) {
  const assignmentId = ping.assignmentId ?? buffer.assignmentId
  const next: DriverLocationPingInput = {
    ...ping,
    assignmentId,
  }
  buffer.pings.push(next)
  buffer.sessionPoints.push({
    lat: next.lat,
    lon: next.lon,
    recordedAt: next.recordedAt,
    accuracyM: next.accuracyM ?? null,
  })
  // Cap session memory for long shifts
  if (buffer.sessionPoints.length > 5000) {
    buffer.sessionPoints.splice(0, buffer.sessionPoints.length - 4000)
  }
  notifyListeners()
}

async function flushBuffer(): Promise<void> {
  const batch = buffer.pings.splice(0, MAX_BATCH)
  if (!batch.length) return
  if (!buffer.online) {
    await enqueueDriverMutation({
      type: 'location.batch',
      payload: { pings: batch },
    })
    return
  }
  try {
    await apiCall('/api/taxi_fleet/driver/location', {
      method: 'POST',
      body: JSON.stringify({ pings: batch }),
    })
  } catch {
    await enqueueDriverMutation({
      type: 'location.batch',
      payload: { pings: batch },
    })
  }
  // Keep flushing if buffer still has points
  if (buffer.pings.length) {
    await flushBuffer()
  }
}

/** Flush pending GPS points (call before clock-out). */
export async function flushDriverLocationTracking(): Promise<void> {
  if (flushImpl) {
    await flushImpl()
    return
  }
  await flushBuffer()
}

/** Pause shell watch while another screen feeds location (e.g. live trip). */
export function beginExternalDriverLocationFeed(): void {
  externalLocationFeed = true
}

export function endExternalDriverLocationFeed(): void {
  externalLocationFeed = false
}

/** Feed a GPS point from live trip (or other screens) into shift tracking. */
export function pushDriverLocationPing(ping: DriverLocationPingInput): void {
  pushToBuffer(ping)
}

export function getDriverTrackingEstimatedKm(): number {
  return aggregateGpsDistanceKm(buffer.sessionPoints)
}

export function getDriverTrackingEstimatedKmLabel(): string {
  return formatGpsDistanceKm(getDriverTrackingEstimatedKm())
}

export function useDriverTrackingEstimatedKm(enabled: boolean): string | null {
  const [, setTick] = React.useState(0)
  React.useEffect(() => {
    if (!enabled) return
    const listener = () => setTick((value) => value + 1)
    listeners.add(listener)
    const id = window.setInterval(listener, 15_000)
    return () => {
      listeners.delete(listener)
      window.clearInterval(id)
    }
  }, [enabled])
  if (!enabled) return null
  const km = getDriverTrackingEstimatedKm()
  return km > 0 ? getDriverTrackingEstimatedKmLabel() : null
}

export function useDriverTracking({ enabled, assignmentId }: Options) {
  const online = useDriverOnlineStatus()

  React.useEffect(() => {
    buffer.online = online
  }, [online])

  React.useEffect(() => {
    buffer.assignmentId = assignmentId ?? null
  }, [assignmentId])

  React.useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.geolocation) {
      flushImpl = null
      return
    }

    // New open shift session — keep prior points if same assignment, else reset estimate.
    if (assignmentId && buffer.assignmentId && assignmentId !== buffer.assignmentId) {
      buffer.sessionPoints = []
    }

    flushImpl = flushBuffer

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (externalLocationFeed) return
        pushToBuffer({
          recordedAt: new Date(position.timestamp).toISOString(),
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracyM: position.coords.accuracy,
          speedMps: position.coords.speed,
          heading: position.coords.heading,
          assignmentId: assignmentId ?? null,
        })
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    )

    const interval = window.setInterval(() => void flushBuffer(), FLUSH_MS)
    return () => {
      navigator.geolocation.clearWatch(watchId)
      window.clearInterval(interval)
      void flushBuffer()
      flushImpl = null
    }
  }, [enabled, assignmentId])
}
