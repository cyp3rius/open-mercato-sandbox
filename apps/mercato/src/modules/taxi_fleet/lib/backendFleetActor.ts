import type { EntityManager } from '@mikro-orm/postgresql'
import { hasFeature } from '@open-mercato/shared/security/features'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { StaffTeamMember } from '@open-mercato/core/modules/staff/data/entities'
import { TaxiFleetDriverProfile } from '../data/entities'

type FleetActorScopeCtx = {
  container: { resolve: (name: string) => unknown }
  auth: { sub?: string | null; tenantId?: string | null; orgId?: string | null } | null
  selectedOrganizationId?: string | null
  organizationScope?: { tenantId?: string | null; selectedId?: string | null } | null
}

export type FleetBackendOperatorActor = {
  role: 'operator'
  canManageTrips: boolean
  canManageAssignments: boolean
}

export type FleetBackendDriverActor = {
  role: 'driver'
  teamMemberId: string
  profileId: string | null
  displayName: string
}

export type FleetBackendActor = FleetBackendOperatorActor | FleetBackendDriverActor

function resolveTenantId(ctx: FleetActorScopeCtx): string | null {
  return ctx.auth?.tenantId ?? ctx.organizationScope?.tenantId ?? null
}

function resolveOrganizationId(ctx: FleetActorScopeCtx): string | null {
  return ctx.selectedOrganizationId ?? ctx.organizationScope?.selectedId ?? ctx.auth?.orgId ?? null
}

async function loadUserFeatures(ctx: FleetActorScopeCtx): Promise<string[]> {
  const userId = ctx.auth?.sub
  const tenantId = resolveTenantId(ctx)
  if (!userId || !tenantId) return []
  const rbac = ctx.container.resolve('rbacService') as {
    loadAcl: (
      userId: string,
      scope: { tenantId: string | null; organizationId: string | null },
    ) => Promise<{ isSuperAdmin: boolean; features: string[] }>
  }
  const acl = await rbac.loadAcl(userId, {
    tenantId,
    organizationId: resolveOrganizationId(ctx),
  })
  if (acl.isSuperAdmin) return ['*']
  return Array.isArray(acl.features) ? acl.features : []
}

export async function resolveFleetBackendActor(ctx: FleetActorScopeCtx): Promise<FleetBackendActor | null> {
  const userId = ctx.auth?.sub
  const tenantId = resolveTenantId(ctx)
  const organizationId = resolveOrganizationId(ctx)
  if (!userId || !tenantId || !organizationId) return null

  const features = await loadUserFeatures(ctx)
  const canManageTrips = hasFeature(features, 'taxi_fleet.manage_trips')
  const canManageAssignments = hasFeature(features, 'taxi_fleet.manage_assignments')
  const isDriverFeature = hasFeature(features, 'taxi_fleet.driver')

  if (canManageTrips || canManageAssignments) {
    return { role: 'operator', canManageTrips, canManageAssignments }
  }

  if (!isDriverFeature) return null

  const em = ctx.container.resolve('em') as EntityManager
  const member = await findOneWithDecryption(
    em,
    StaffTeamMember,
    { userId, deletedAt: null },
    undefined,
    { tenantId, organizationId },
  )
  if (!member) return null

  const profile = await findOneWithDecryption(
    em,
    TaxiFleetDriverProfile,
    { teamMemberId: member.id, deletedAt: null },
    undefined,
    { tenantId, organizationId },
  )

  return {
    role: 'driver',
    teamMemberId: member.id,
    profileId: profile?.id ?? null,
    displayName: member.displayName,
  }
}

export async function applyFleetDriverListScope(
  ctx: FleetActorScopeCtx,
  filters: Record<string, unknown>,
  queryTeamMemberId?: string,
): Promise<Record<string, unknown>> {
  const actor = await resolveFleetBackendActor(ctx)
  if (!actor || actor.role !== 'driver') {
    if (queryTeamMemberId) filters.team_member_id = queryTeamMemberId
    return filters
  }
  filters.team_member_id = actor.teamMemberId
  return filters
}

export async function assertFleetDriverCanAccessTrip(
  ctx: FleetActorScopeCtx,
  teamMemberId: string | null | undefined,
): Promise<void> {
  const actor = await resolveFleetBackendActor(ctx)
  if (!actor || actor.role !== 'driver') return
  if (teamMemberId !== actor.teamMemberId) {
    throw new Error('forbidden_trip_scope')
  }
}
