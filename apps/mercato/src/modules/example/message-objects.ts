import type { MessageObjectTypeDefinition } from '@open-mercato/shared/modules/messages/types'
import { messageObjectTypes as base } from './message-objects.shared'

export const messageObjectTypes: MessageObjectTypeDefinition[] = base.map((def) => {
  if (def.module === 'example' && def.entityType === 'todo') {
    return {
      ...def,
      loadPreview: async (entityId, ctx) => {
        const { loadTodoPreview } = await import('./lib/messageObjectPreviews')
        return loadTodoPreview(entityId, ctx)
      },
    }
  }
  return def
})

export default messageObjectTypes
