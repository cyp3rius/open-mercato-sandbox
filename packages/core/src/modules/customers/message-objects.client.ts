import type { LoadContext, MessageObjectTypeDefinition } from '@open-mercato/shared/modules/messages/types'
import { messageObjectTypes as base } from './message-objects.shared'

const titles: Record<string, string> = {
  'customers:person': 'Person',
  'customers:company': 'Company',
  'customers:deal': 'Deal',
}

export const messageObjectTypes: MessageObjectTypeDefinition[] = base.map((def) => {
  const key = `${def.module}:${def.entityType}`
  const title = titles[key] ?? def.entityType
  return {
    ...def,
    loadPreview: async (entityId: string, _ctx: LoadContext) => ({ title, subtitle: entityId }),
  }
})

export default messageObjectTypes
