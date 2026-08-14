'use client'

import React from 'react'
import { enqueueDriverMutation } from '../../lib/driverOffline/outbox'
import { useDriverOnlineStatus } from './useDriverOnlineStatus'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

type Options = {
  enabled: boolean
  assignmentId?: string | null
}

type BufferedPing = {
  recordedAt: string
  lat: number
  lon: number
  accuracyM?: number | null
  speedMps?: number | null
  heading?: number | null
  assignmentId?: string | null
}

const FLUSH_MS = 45_000

export function useDriverTracking({ enabled, assignmentId }: Options) {
  const online = useDriverOnlineStatus()
  const bufferRef = React.useRef<BufferedPing[]>([])

  React.useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.geolocation) return

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        bufferRef.current.push({
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
      { enableHighAccuracy: false, maximumAge: 15_000, timeout: 20_000 },
    )

    const flush = async () => {
      const batch = bufferRef.current.splice(0, 50)
      if (!batch.length) return
      if (!online) {
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
    }

    const interval = window.setInterval(() => void flush(), FLUSH_MS)
    return () => {
      navigator.geolocation.clearWatch(watchId)
      window.clearInterval(interval)
      void flush()
    }
  }, [enabled, assignmentId, online])
}
