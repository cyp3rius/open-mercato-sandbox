"use client"

import * as React from 'react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

export type FleetBackendSession = {
  role: 'operator' | 'driver'
  canManageTrips?: boolean
  canManageAssignments?: boolean
  teamMemberId?: string | null
  profileId?: string | null
  displayName?: string | null
}

export function useFleetBackendSession() {
  const [session, setSession] = React.useState<FleetBackendSession | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      const call = await apiCall<FleetBackendSession>('/api/taxi_fleet/session')
      if (cancelled) return
      setSession(call.ok && call.result ? call.result : null)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const isDriverOnly = session?.role === 'driver'
  const lockedTeamMemberId = isDriverOnly ? session?.teamMemberId ?? null : null

  return {
    session,
    loading,
    isDriverOnly,
    lockedTeamMemberId,
    canManageTrips: session?.role === 'operator' ? Boolean(session.canManageTrips) : false,
    canManageAssignments: session?.role === 'operator' ? Boolean(session.canManageAssignments) : false,
  }
}
