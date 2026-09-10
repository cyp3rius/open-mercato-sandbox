'use client'

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
type TeamMemberItem = {
  id?: string
  displayName?: string
  display_name?: string
  name?: string
}
type TeamMembersResponse = { items: TeamMemberItem[] }

const UUID_LIKE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function readMemberDisplayName(member: TeamMemberItem): string | null {
  const candidates = [member.displayName, member.display_name, member.name]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const trimmed = candidate.trim()
    if (trimmed.length && !UUID_LIKE.test(trimmed)) return trimmed
  }
  return null
}

function chunkIds(ids: string[], size: number): string[][] {
  if (ids.length <= size) return ids.length ? [ids] : []
  const chunks: string[][] = []
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size))
  }
  return chunks
}

async function loadTeamMemberNames(memberIds: string[]): Promise<Record<string, string>> {
  const uniqueIds = [...new Set(memberIds.filter((id) => Boolean(id?.trim())))]
  if (!uniqueIds.length) return {}

  const names: Record<string, string> = {}
  for (const chunk of chunkIds(uniqueIds, 80)) {
    const params = new URLSearchParams({
      page: '1',
      pageSize: String(Math.min(100, Math.max(chunk.length, 1))),
      ids: chunk.join(','),
    })
    const memberCall = await apiCall<TeamMembersResponse>(`/api/staff/team-members?${params}`)
    const members = Array.isArray(memberCall.result?.items) ? memberCall.result.items : []
    for (const member of members) {
      const id = typeof member.id === 'string' ? member.id : null
      if (!id) continue
      const displayName = readMemberDisplayName(member)
      if (displayName) names[id] = displayName
    }
  }
  return names
}

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

    const profileMemberIds = loadedProfiles
      .map((profile) => profile.teamMemberId)
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)

    const names = await loadTeamMemberNames(profileMemberIds)
    setNameByMemberId(names)
    setIsLoading(false)
  }, [])

  React.useEffect(() => {
    void reload()
  }, [reload, scopeVersion])

  const resolveName = React.useCallback(
    (teamMemberId: string) => {
      const known = nameByMemberId[teamMemberId]?.trim()
      if (known && !UUID_LIKE.test(known)) return known
      return teamMemberId
    },
    [nameByMemberId],
  )

  const resolvePayoutPercent = React.useCallback(
    (teamMemberId: string) => profiles.find((profile) => profile.teamMemberId === teamMemberId)?.payoutPercent ?? null,
    [profiles],
  )

  const resolveDriverProfileId = React.useCallback(
    (teamMemberId: string) => profiles.find((profile) => profile.teamMemberId === teamMemberId)?.id ?? null,
    [profiles],
  )

  return {
    profiles,
    nameByMemberId,
    resolveName,
    resolvePayoutPercent,
    resolveDriverProfileId,
    isLoading,
    reload,
  }
}

/** Loads display names for team-member IDs that are not yet in the shared directory cache. */
export function useEnsureFleetDriverNames() {
  const loadedRef = React.useRef<Record<string, string>>({})

  return React.useCallback(async (memberIds: string[]) => {
    const missing = [
      ...new Set(
        memberIds.filter((id) => {
          const trimmed = id?.trim()
          if (!trimmed) return false
          return !loadedRef.current[trimmed]
        }),
      ),
    ]
    if (!missing.length) return {}
    const loaded = await loadTeamMemberNames(missing)
    loadedRef.current = { ...loadedRef.current, ...loaded }
    return loaded
  }, [])
}
