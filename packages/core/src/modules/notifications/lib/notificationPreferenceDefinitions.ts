import type { NotificationUserPreferenceDefinition } from '@open-mercato/shared/modules/notifications/types'
import { hasFeature } from '@open-mercato/shared/security/features'
import {
  getAllNotificationTypeDefinitions,
  getNotificationTypeDefinition,
} from './notification-types-registry'
import { CORE_NOTIFICATION_PREFERENCE_DEFINITIONS } from './notificationPreferenceCatalog'

export function resolveNotificationPreferenceDefinition(
  notificationType: string,
): NotificationUserPreferenceDefinition | undefined {
  const typeDef = getNotificationTypeDefinition(notificationType)
  if (typeDef?.userPreference) return typeDef.userPreference
  return CORE_NOTIFICATION_PREFERENCE_DEFINITIONS[notificationType]
}

export function listConfigurableNotificationTypes(): Array<{
  type: string
  module: string
  preference: NotificationUserPreferenceDefinition
}> {
  const entries = new Map<string, { type: string; module: string; preference: NotificationUserPreferenceDefinition }>()

  for (const typeDef of getAllNotificationTypeDefinitions()) {
    if (typeDef.userPreference) {
      entries.set(typeDef.type, {
        type: typeDef.type,
        module: typeDef.module,
        preference: typeDef.userPreference,
      })
    }
  }

  for (const [type, preference] of Object.entries(CORE_NOTIFICATION_PREFERENCE_DEFINITIONS)) {
    if (entries.has(type)) continue
    const typeDef = getNotificationTypeDefinition(type)
    entries.set(type, {
      type,
      module: typeDef?.module ?? type.split('.')[0] ?? 'notifications',
      preference,
    })
  }

  return Array.from(entries.values()).sort((left, right) => left.type.localeCompare(right.type))
}

export function userHasModuleAccess(features: string[], moduleId: string): boolean {
  if (features.includes('*')) return true
  if (hasFeature(features, `${moduleId}.*`)) return true
  return features.some((feature) => feature.startsWith(`${moduleId}.`))
}

export function userHasScopeForPreference(
  features: string[],
  preference: NotificationUserPreferenceDefinition,
  moduleId: string,
): boolean {
  if (features.includes('*')) return true
  if (userHasModuleAccess(features, moduleId)) return true
  return hasFeature(features, preference.scopeFeature)
}
