import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { resolveFleetBackendActor } from '../../lib/backendFleetActor'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['taxi_fleet.view'] },
}

const responseSchema = z.object({
  role: z.enum(['operator', 'driver']),
  canManageTrips: z.boolean().optional(),
  canManageAssignments: z.boolean().optional(),
  teamMemberId: z.string().uuid().nullable().optional(),
  profileId: z.string().uuid().nullable().optional(),
  displayName: z.string().nullable().optional(),
})

export async function GET(req: Request) {
  const container = await createRequestContainer()
  const auth = await getAuthFromRequest(req)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
  const actor = await resolveFleetBackendActor({
    container,
    auth,
    organizationScope: scope,
    selectedOrganizationId: scope?.selectedId ?? auth.orgId ?? null,
  })

  if (!actor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (actor.role === 'operator') {
    return NextResponse.json({
      role: 'operator',
      canManageTrips: actor.canManageTrips,
      canManageAssignments: actor.canManageAssignments,
      teamMemberId: null,
      profileId: null,
      displayName: null,
    })
  }

  return NextResponse.json({
    role: 'driver',
    teamMemberId: actor.teamMemberId,
    profileId: actor.profileId,
    displayName: actor.displayName,
  })
}

export const openApi = {
  GET: {
    summary: 'Resolve taxi fleet backend session actor',
    tags: ['Taxi fleet'],
    responses: [{ status: 200, description: 'Actor payload', schema: responseSchema }],
  },
}
