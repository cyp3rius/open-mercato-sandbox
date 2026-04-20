import type { MessageObjectTypeDefinition } from '@open-mercato/shared/modules/messages/types'
import { messageObjectTypes as base } from './message-objects.shared'

export const messageObjectTypes: MessageObjectTypeDefinition[] = base.map((def) => {
  if (def.module === 'sales' && def.entityType === 'order') {
    return {
      ...def,
      loadPreview: async (entityId, ctx) => {
        const { loadSalesOrderPreview } = await import('./lib/messageObjectPreviews')
        return loadSalesOrderPreview(entityId, ctx)
      },
    }
  }
  if (def.module === 'sales' && def.entityType === 'quote') {
    return {
      ...def,
      loadPreview: async (entityId, ctx) => {
        const { loadSalesQuotePreview } = await import('./lib/messageObjectPreviews')
        return loadSalesQuotePreview(entityId, ctx)
      },
    }
  }
  if (def.module === 'sales' && def.entityType === 'channel') {
    return {
      ...def,
      loadPreview: async (entityId, ctx) => {
        const { loadSalesChannelPreview } = await import('./lib/messageObjectPreviews')
        return loadSalesChannelPreview(entityId, ctx)
      },
    }
  }
  return def
})

export default messageObjectTypes
