import type { EntityManager } from '@mikro-orm/postgresql'
import { findOneWithDecryption, findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { TaxiFleetDailyAssignment } from '../data/entities'

export type AssignmentConflict = 'member' | 'resource'

export async function findAssignmentConflict(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    assignmentDate: string
    teamMemberId: string
    resourceId: string
    excludeId?: string | null
  },
): Promise<AssignmentConflict | null> {
  const scope = {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    assignmentDate: params.assignmentDate,
    deletedAt: null,
  }
  const memberConflict = await findOneWithDecryption(
    em,
    TaxiFleetDailyAssignment,
    {
      ...scope,
      teamMemberId: params.teamMemberId,
      ...(params.excludeId ? { id: { $ne: params.excludeId } } : {}),
    },
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )
  if (memberConflict) return 'member'

  const resourceConflict = await findOneWithDecryption(
    em,
    TaxiFleetDailyAssignment,
    {
      ...scope,
      resourceId: params.resourceId,
      ...(params.excludeId ? { id: { $ne: params.excludeId } } : {}),
      status: { $ne: 'cancelled' },
      // Ended shifts free the vehicle for a new assignment the same day.
      shiftEnd: null,
    },
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )
  if (resourceConflict) return 'resource'

  return null
}

/** Resource IDs that already have a non-cancelled, not-yet-ended assignment on the given date. */
export async function findAssignedResourceIdsForDate(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    assignmentDate: string
    resourceIds?: string[]
    excludeAssignmentId?: string | null
  },
): Promise<Set<string>> {
  const busy = new Set<string>()
  const scopedIds = (params.resourceIds ?? []).map((id) => id.trim()).filter(Boolean)
  if (params.resourceIds && !scopedIds.length) return busy

  const rows = await findWithDecryption(
    em,
    TaxiFleetDailyAssignment,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      assignmentDate: params.assignmentDate,
      deletedAt: null,
      status: { $ne: 'cancelled' },
      shiftEnd: null,
      ...(scopedIds.length ? { resourceId: { $in: scopedIds } } : {}),
      ...(params.excludeAssignmentId ? { id: { $ne: params.excludeAssignmentId } } : {}),
    },
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )
  for (const row of rows) {
    if (row.resourceId) busy.add(row.resourceId)
  }
  return busy
}

function isInactiveAssignment(row: TaxiFleetDailyAssignment): boolean {
  return Boolean(row.deletedAt) || row.status === 'cancelled' || Boolean(row.shiftEnd)
}

/**
 * Soft-deleted / cancelled rows still occupy DB unique indexes on
 * (member, date) and (resource, date). Find them (including deleted)
 * so callers can reclaim or remove ghosts before insert.
 */
export async function findAssignmentUniqueBlockers(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    assignmentDate: string
    teamMemberId: string
    resourceId: string
  },
): Promise<TaxiFleetDailyAssignment[]> {
  return findWithDecryption(
    em,
    TaxiFleetDailyAssignment,
    {
      tenantId: params.tenantId,
      organizationId: params.organizationId,
      assignmentDate: params.assignmentDate,
      $or: [{ teamMemberId: params.teamMemberId }, { resourceId: params.resourceId }],
    },
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )
}

/**
 * Prepare a row for ad-hoc self-start: reuse an inactive unique blocker when possible,
 * hard-remove other inactive ghosts that would still violate unique constraints.
 */
export function resolveSelfStartAssignmentRow(input: {
  blockers: TaxiFleetDailyAssignment[]
  teamMemberId: string
  resourceId: string
}):
  | { ok: true; row: TaxiFleetDailyAssignment | null; remove: TaxiFleetDailyAssignment[] }
  | { ok: false; conflict: AssignmentConflict } {
  const active = input.blockers.filter((row) => !isInactiveAssignment(row))
  for (const row of active) {
    if (row.teamMemberId === input.teamMemberId) {
      return { ok: false, conflict: 'member' }
    }
    if (row.resourceId === input.resourceId) {
      return { ok: false, conflict: 'resource' }
    }
  }

  const inactive = input.blockers.filter((row) => isInactiveAssignment(row))
  if (!inactive.length) {
    return { ok: true, row: null, remove: [] }
  }

  const preferResource =
    inactive.find((row) => row.resourceId === input.resourceId) ??
    inactive.find((row) => row.teamMemberId === input.teamMemberId) ??
    inactive[0] ??
    null

  const remove = inactive.filter((row) => preferResource && row.id !== preferResource.id)
  return { ok: true, row: preferResource, remove }
}
