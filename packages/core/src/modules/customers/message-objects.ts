import type { MessageObjectTypeDefinition } from '@open-mercato/shared/modules/messages/types'
import { messageObjectTypes as base } from './message-objects.shared'

export const messageObjectTypes: MessageObjectTypeDefinition[] = base.map((def) => {
  if (def.module === 'customers' && def.entityType === 'person') {
    return {
      ...def,
      loadPreview: async (entityId, ctx) => {
        const { loadCustomerPersonPreview } = await import('./lib/messageObjectPreviews')
        return loadCustomerPersonPreview(entityId, ctx)
      },
    }
  }
  if (def.module === 'customers' && def.entityType === 'company') {
    return {
      ...def,
      loadPreview: async (entityId, ctx) => {
        const { loadCustomerCompanyPreview } = await import('./lib/messageObjectPreviews')
        return loadCustomerCompanyPreview(entityId, ctx)
      },
    }
  }
  if (def.module === 'customers' && def.entityType === 'deal') {
    return {
      ...def,
      loadPreview: async (entityId, ctx) => {
        const { loadCustomerDealPreview } = await import('./lib/messageObjectPreviews')
        return loadCustomerDealPreview(entityId, ctx)
      },
    }
  }
  return def
})

export default messageObjectTypes
