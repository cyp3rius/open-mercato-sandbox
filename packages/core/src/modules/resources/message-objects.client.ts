import type { LoadContext, MessageObjectTypeDefinition } from '@open-mercato/shared/modules/messages/types'
import { messageObjectTypes as base } from './message-objects.shared'

export const messageObjectTypes: MessageObjectTypeDefinition[] = base.map((def) => ({
  ...def,
  loadPreview: async (entityId: string, _ctx: LoadContext) => ({ title: 'Resource', subtitle: entityId }),
}))

export default messageObjectTypes
