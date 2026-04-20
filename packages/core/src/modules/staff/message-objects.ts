import type { MessageObjectTypeDefinition } from '@open-mercato/shared/modules/messages/types'
import { messageObjectTypes as base } from './message-objects.shared'

export const messageObjectTypes: MessageObjectTypeDefinition[] = base.map((def) => {
  if (def.module === 'staff' && def.entityType === 'leave_request') {
    return {
      ...def,
      loadPreview: async (entityId, ctx) => {
        const { loadLeaveRequestPreview } = await import('./lib/messageObjectPreviews')
        return loadLeaveRequestPreview(entityId, ctx)
      },
    }
  }
  if (def.module === 'staff' && def.entityType === 'team') {
    return {
      ...def,
      loadPreview: async (entityId, ctx) => {
        const { loadTeamPreview } = await import('./lib/messageObjectPreviews')
        return loadTeamPreview(entityId, ctx)
      },
    }
  }
  if (def.module === 'staff' && def.entityType === 'team_member') {
    return {
      ...def,
      loadPreview: async (entityId, ctx) => {
        const { loadTeamMemberPreview } = await import('./lib/messageObjectPreviews')
        return loadTeamMemberPreview(entityId, ctx)
      },
    }
  }
  if (def.module === 'staff' && def.entityType === 'team_role') {
    return {
      ...def,
      loadPreview: async (entityId, ctx) => {
        const { loadStaffTeamRolePreview } = await import('./lib/messageObjectPreviews')
        return loadStaffTeamRolePreview(entityId, ctx)
      },
    }
  }
  if (def.module === 'staff' && def.entityType === 'my_availability') {
    return {
      ...def,
      loadPreview: async (entityId, ctx) => {
        const { loadStaffAvailabilityPreview } = await import('./lib/messageObjectPreviews')
        return loadStaffAvailabilityPreview(entityId, ctx)
      },
    }
  }
  return def
})

export default messageObjectTypes
