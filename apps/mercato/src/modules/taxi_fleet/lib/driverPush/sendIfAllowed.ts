import type { EntityManager } from '@mikro-orm/postgresql'
import { shouldDeliverPush } from '@open-mercato/core/modules/notifications/lib/notificationPreferenceService'
import { resolveTeamMemberUserId } from '../resolveTeamMemberUserId'
import { preferenceTypeForPushKind, type DriverPushKind, type DriverPushPayload } from './pushPayload'
import { sendDriverWebPush } from './sendWebPush'

/**
 * Resolve driver user, check push preference, then send Web Push.
 * Returns false when skipped (no user / preference off / not configured).
 */
export async function sendDriverPushIfAllowed(
  em: EntityManager,
  params: {
    tenantId: string
    organizationId: string
    teamMemberId: string
    kind: DriverPushKind
    payload: Omit<DriverPushPayload, 'kind'> & { kind?: DriverPushKind }
  },
): Promise<boolean> {
  const userId = await resolveTeamMemberUserId(em, params.teamMemberId, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
  })
  if (!userId) return false

  const preferenceType = preferenceTypeForPushKind(params.kind)
  const allowed = await shouldDeliverPush(em, userId, params.tenantId, preferenceType)
  if (!allowed) return false

  const result = await sendDriverWebPush(em, {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    teamMemberId: params.teamMemberId,
    payload: {
      ...params.payload,
      kind: params.kind,
    },
  })
  return result.delivered > 0 || result.attempted === 0
}
