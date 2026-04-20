import type { LoadContext, MessageObjectTypeDefinition } from '@open-mercato/shared/modules/messages/types'
import { messageObjectTypes as base } from './message-objects.shared'

const titles: Record<string, string> = {
  'sales:order': 'Sales order',
  'sales:quote': 'Sales quote',
  'sales:channel': 'Sales channel',
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
