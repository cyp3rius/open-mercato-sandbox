"use client"

import * as React from 'react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

type PermissionState = {
  canManageTrips: boolean
  canManageSettlements: boolean
  canManageAssignments: boolean
  canManagePlatformSync: boolean
  isLoading: boolean
}

export function useTaxiFleetPermissions(): PermissionState {
  const [state, setState] = React.useState<PermissionState>({
    canManageTrips: false,
    canManageSettlements: false,
    canManageAssignments: false,
    canManagePlatformSync: false,
    isLoading: true,
  })

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      const call = await apiCall<{ granted?: string[]; ok?: boolean }>('/api/auth/feature-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          features: [
            'taxi_fleet.manage_trips',
            'taxi_fleet.manage_settlements',
            'taxi_fleet.manage_assignments',
            'taxi_fleet.manage_platform_sync',
          ],
        }),
      })
      if (cancelled) return
      const granted = Array.isArray(call.result?.granted) ? call.result.granted : []
      const allGranted = call.result?.ok === true
      setState({
        canManageTrips: allGranted || granted.includes('taxi_fleet.manage_trips'),
        canManageSettlements: allGranted || granted.includes('taxi_fleet.manage_settlements'),
        canManageAssignments: allGranted || granted.includes('taxi_fleet.manage_assignments'),
        canManagePlatformSync: allGranted || granted.includes('taxi_fleet.manage_platform_sync'),
        isLoading: false,
      })
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
