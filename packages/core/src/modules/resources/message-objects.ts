import type { MessageObjectTypeDefinition } from '@open-mercato/shared/modules/messages/types'
import { messageObjectTypes as base } from './message-objects.shared'

export const messageObjectTypes: MessageObjectTypeDefinition[] = base.map((def) => {
  if (def.module === 'resources' && def.entityType === 'resource') {
    return {
      ...def,
      loadPreview: async (entityId, ctx) => {
        const { loadResourcePreview } = await import('./lib/messageObjectPreviews')
        return loadResourcePreview(entityId, ctx)
      },
    }
  }
  return def
})

export default messageObjectTypes
