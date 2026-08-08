"use client"

import * as React from 'react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'

export type FleetDriverProfile = {
  id: string
  teamMemberId: string
  payoutPercent: string
  externalAppEnabled: boolean
}

type DriverProfilesResponse = { items: FleetDriverProfile[] }
type TeamMemberItem = { id?: string; displayName?: string; display_name?: string }
type TeamMembersResponse = { items: TeamMemberItem[] }

export function useFleetDriverDirectory() {
  const scopeVersion = useOrganizationScopeVersion()
  const [profiles, setProfiles] = React.useState<FleetDriverProfile[]>([])
  const [nameByMemberId, setNameByMemberId] = React.useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = React.useState(true)

  const reload = React.useCallback(async () => {
    setIsLoading(true)
    const profileCall = await apiCall<DriverProfilesResponse>('/api/taxi_fleet/driver-profiles?page=1&pageSize=100')
    const loadedProfiles = Array.isArray(profileCall.result?.items) ? profileCall.result.items : []
    setProfiles(loadedProfiles)

    const memberCall = await apiCall<TeamMembersResponse>('/api/staff/team-members?page=1&pageSize=100')
    const members = Array.isArray(memberCall.result?.items) ? memberCall.result.items : []
    const names: Record<string, string> = {}
    members.forEach((member) => {
      const id = typeof member.id === 'string' ? member.id : null
      const displayName =
        typeof member.displayName === 'string'
          ? member.displayName
          : typeof member.display_name === 'string'
            ? member.display_name
            : null
      if (id && displayName) names[id] = displayName
    })
    setNameByMemberId(names)
    setIsLoading(false)
  }, [])

  React.useEffect(() => {
    void reload()
  }, [reload, scopeVersion])

  const resolveName = React.useCallback(
    (teamMemberId: string) => nameByMemberId[teamMemberId] ?? teamMemberId,
    [nameByMemberId],
  )

  return { profiles, nameByMemberId, resolveName, isLoading, reload }
}
