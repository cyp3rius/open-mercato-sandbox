import type { MessageObjectTypeDefinition } from '@open-mercato/shared/modules/messages/types'
import { messageObjectTypes as base } from './message-objects.shared'

export const messageObjectTypes: MessageObjectTypeDefinition[] = base.map((def) => {
  if (def.module === 'currencies' && def.entityType === 'currency') {
    return {
      ...def,
      loadPreview: async (entityId, ctx) => {
        const { loadCurrencyPreview } = await import('./lib/messageObjectPreviews')
        return loadCurrencyPreview(entityId, ctx)
      },
    }
  }
  return def
})

export default messageObjectTypes
