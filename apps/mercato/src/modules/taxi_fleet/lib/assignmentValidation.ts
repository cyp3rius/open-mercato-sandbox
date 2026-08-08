import type { EntityManager } from '@mikro-orm/postgresql'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
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
    },
    undefined,
    { tenantId: params.tenantId, organizationId: params.organizationId },
  )
  if (resourceConflict) return 'resource'

  return null
}
