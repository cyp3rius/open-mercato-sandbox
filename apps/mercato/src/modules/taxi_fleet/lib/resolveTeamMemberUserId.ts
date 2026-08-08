import type { EntityManager } from '@mikro-orm/postgresql'
import { findOneWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { StaffTeamMember } from '@open-mercato/core/modules/staff/data/entities'

export async function resolveTeamMemberUserId(
  em: EntityManager,
  teamMemberId: string,
  scope: { tenantId: string; organizationId: string },
): Promise<string | null> {
  const member = await findOneWithDecryption(
    em,
    StaffTeamMember,
    { id: teamMemberId, deletedAt: null },
    undefined,
    scope,
  )
  const userId = member?.userId?.trim()
  return userId?.length ? userId : null
}
