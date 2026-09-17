"use client"

import * as React from 'react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

type PermissionState = {
  canManageTrips: boolean
  canEditCompletedTrips: boolean
  canAuthorizeInternalTrips: boolean
  canManageSettlements: boolean
  canManageAssignments: boolean
  canManagePlatformSync: boolean
  canImpersonateDriver: boolean
  canManageDriverCommunications: boolean
  canPurgeReceipts: boolean
  isLoading: boolean
}

export function useTaxiFleetPermissions(): PermissionState {
  const [state, setState] = React.useState<PermissionState>({
    canManageTrips: false,
    canEditCompletedTrips: false,
    canAuthorizeInternalTrips: false,
    canManageSettlements: false,
    canManageAssignments: false,
    canManagePlatformSync: false,
    canImpersonateDriver: false,
    canManageDriverCommunications: false,
    canPurgeReceipts: false,
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
            'taxi_fleet.trips.edit_completed',
            'taxi_fleet.trips.authorize_internal',
            'taxi_fleet.manage_settlements',
            'taxi_fleet.manage_assignments',
            'taxi_fleet.manage_platform_sync',
            'taxi_fleet.driver.impersonate',
            'taxi_fleet.manage_driver_communications',
            'taxi_fleet.receipts.purge',
          ],
        }),
      })
      if (cancelled) return
      const granted = Array.isArray(call.result?.granted) ? call.result.granted : []
      const allGranted = call.result?.ok === true
      setState({
        canManageTrips: allGranted || granted.includes('taxi_fleet.manage_trips'),
        canEditCompletedTrips:
          allGranted || granted.includes('taxi_fleet.trips.edit_completed'),
        canAuthorizeInternalTrips:
          allGranted || granted.includes('taxi_fleet.trips.authorize_internal'),
        canManageSettlements: allGranted || granted.includes('taxi_fleet.manage_settlements'),
        canManageAssignments: allGranted || granted.includes('taxi_fleet.manage_assignments'),
        canManagePlatformSync: allGranted || granted.includes('taxi_fleet.manage_platform_sync'),
        canImpersonateDriver: allGranted || granted.includes('taxi_fleet.driver.impersonate'),
        canManageDriverCommunications:
          allGranted || granted.includes('taxi_fleet.manage_driver_communications'),
        canPurgeReceipts: allGranted || granted.includes('taxi_fleet.receipts.purge'),
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
