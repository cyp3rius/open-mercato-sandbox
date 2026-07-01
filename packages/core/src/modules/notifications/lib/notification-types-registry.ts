import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

const registry = new Map<string, NotificationTypeDefinition>()

export type RegisterNotificationTypesOptions = {
  replace?: boolean
}

export function registerNotificationTypes(
  types: NotificationTypeDefinition[],
  options: RegisterNotificationTypesOptions = {},
): void {
  if (options.replace) {
    registry.clear()
  }
  for (const type of types) {
    if (registry.has(type.type)) {
      console.warn(`[notifications] Notification type "${type.type}" is already registered, overwriting`)
    }
    registry.set(type.type, type)
  }
}

export function getNotificationTypeDefinition(type: string): NotificationTypeDefinition | undefined {
  return registry.get(type)
}

export function getAllNotificationTypeDefinitions(): NotificationTypeDefinition[] {
  return Array.from(registry.values())
}

export function getNotificationTypeDefinitionsByModule(moduleId: string): NotificationTypeDefinition[] {
  return getAllNotificationTypeDefinitions().filter((entry) => entry.module === moduleId)
}
