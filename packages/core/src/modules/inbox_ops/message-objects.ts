import type { MessageObjectTypeDefinition } from '@open-mercato/shared/modules/messages/types'
import { messageObjectTypes as base } from './message-objects.shared'

export const messageObjectTypes: MessageObjectTypeDefinition[] = base.map((def) => {
  if (def.module === 'inbox_ops' && def.entityType === 'inbox_email') {
    return {
      ...def,
      loadPreview: async (entityId, ctx) => {
        try {
          const { loadInboxEmailPreview } = await import('./lib/messageObjectPreviews')
          return loadInboxEmailPreview(entityId, ctx)
        } catch {
          return { title: 'Inbox Email', subtitle: entityId }
        }
      },
    }
  }
  return def
})

export default messageObjectTypes
