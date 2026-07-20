import type { EntityManager } from '@mikro-orm/core'
import type { Knex } from 'knex'
import { hasFeature } from '@open-mercato/shared/security/features'
import { UserNotificationPreference } from '../data/entities'
import { getRecipientUserIdsForFeature } from './notificationRecipients'
import {
  listConfigurableNotificationTypes,
  resolveNotificationPreferenceDefinition,
  userHasScopeForPreference,
} from './notificationPreferenceDefinitions'

interface RoleAclRow {
  features_json: unknown
  is_super_admin: boolean
}

function normalizeFeatures(features: unknown): string[] {
  if (!Array.isArray(features)) return []
  return features.filter((feature): feature is string => typeof feature === 'string')
}

function getKnex(em: EntityManager): Knex {
  return (em.getConnection() as unknown as { getKnex: () => Knex }).getKnex()
}

export async function getRoleGrantedFeaturesForUser(
  knex: Knex,
  userId: string,
  tenantId: string,
): Promise<string[]> {
  const rows = await knex('role_acls')
    .join('user_roles', 'role_acls.role_id', 'user_roles.role_id')
    .join('users', 'user_roles.user_id', 'users.id')
    .where('role_acls.tenant_id', tenantId)
    .whereNull('role_acls.deleted_at')
    .whereNull('user_roles.deleted_at')
    .whereNull('users.deleted_at')
    .where('users.tenant_id', tenantId)
    .where('users.id', userId)
    .select('role_acls.features_json', 'role_acls.is_super_admin')

  const features = new Set<string>()
  for (const row of rows as RoleAclRow[]) {
    if (row.is_super_admin) {
      features.add('*')
      continue
    }
    for (const feature of normalizeFeatures(row.features_json)) {
      features.add(feature)
    }
  }
  return Array.from(features)
}

export function isPreferenceLockedByRole(
  roleFeatures: string[],
  preference: NonNullable<ReturnType<typeof resolveNotificationPreferenceDefinition>>,
): boolean {
  if (!preference.lockedWhenRoleGrants || !preference.lockFeature) return false
  return hasFeature(roleFeatures, preference.lockFeature)
}

export async function getStoredPreferenceMap(
  em: EntityManager,
  userId: string,
  tenantId: string,
): Promise<Map<string, boolean>> {
  const rows = await em.find(UserNotificationPreference, { userId, tenantId })
  return new Map(rows.map((row) => [row.notificationType, row.enabled]))
}

export function resolveEffectivePreferenceEnabled(options: {
  notificationType: string
  storedPreferences: Map<string, boolean>
  roleFeatures: string[]
}): { enabled: boolean; locked: boolean } {
  const preference = resolveNotificationPreferenceDefinition(options.notificationType)
  if (!preference) {
    return { enabled: true, locked: false }
  }

  const locked = isPreferenceLockedByRole(options.roleFeatures, preference)
  if (locked) {
    return { enabled: true, locked: true }
  }

  if (options.storedPreferences.has(options.notificationType)) {
    return {
      enabled: options.storedPreferences.get(options.notificationType) === true,
      locked: false,
    }
  }

  return {
    enabled: preference.defaultEnabled ?? true,
    locked: false,
  }
}

export async function shouldDeliverNotification(
  em: EntityManager,
  userId: string,
  tenantId: string,
  notificationType: string,
): Promise<boolean> {
  const preference = resolveNotificationPreferenceDefinition(notificationType)
  if (!preference) return true

  const knex = getKnex(em)
  const [storedPreferences, roleFeatures] = await Promise.all([
    getStoredPreferenceMap(em, userId, tenantId),
    getRoleGrantedFeaturesForUser(knex, userId, tenantId),
  ])

  return resolveEffectivePreferenceEnabled({
    notificationType,
    storedPreferences,
    roleFeatures,
  }).enabled
}

export async function filterRecipientsByNotificationPreferences(
  em: EntityManager,
  tenantId: string,
  notificationType: string,
  recipientUserIds: string[],
): Promise<string[]> {
  const preference = resolveNotificationPreferenceDefinition(notificationType)
  if (!preference) return recipientUserIds

  const filtered: string[] = []
  for (const recipientUserId of recipientUserIds) {
    if (await shouldDeliverNotification(em, recipientUserId, tenantId, notificationType)) {
      filtered.push(recipientUserId)
    }
  }
  return filtered
}

export async function resolveRecipientsForNotificationType(
  em: EntityManager,
  tenantId: string,
  notificationType: string,
): Promise<string[]> {
  const preference = resolveNotificationPreferenceDefinition(notificationType)
  if (!preference) return []

  const knex = getKnex(em)
  const recipientIds = new Set<string>()

  const scopeRecipients = await getRecipientUserIdsForFeature(knex, tenantId, preference.scopeFeature)
  for (const recipientUserId of scopeRecipients) {
    recipientIds.add(recipientUserId)
  }

  if (preference.lockFeature) {
    const lockRecipients = await getRecipientUserIdsForFeature(knex, tenantId, preference.lockFeature)
    for (const recipientUserId of lockRecipients) {
      recipientIds.add(recipientUserId)
    }
  }

  const enabledPreferences = await em.find(UserNotificationPreference, {
    tenantId,
    notificationType,
    enabled: true,
  })
  for (const row of enabledPreferences) {
    recipientIds.add(row.userId)
  }

  return filterRecipientsByNotificationPreferences(
    em,
    tenantId,
    notificationType,
    Array.from(recipientIds),
  )
}

export type NotificationPreferenceModuleGroup = {
  moduleId: string
  moduleTitle: string
  types: Array<{
    type: string
    labelKey: string
    enabled: boolean
    locked: boolean
    audience?: 'global' | 'individual'
  }>
}

export function buildNotificationPreferenceGroups(options: {
  userFeatures: string[]
  roleFeatures: string[]
  storedPreferences: Map<string, boolean>
  modules: Array<{ id: string; title: string }>
}): NotificationPreferenceModuleGroup[] {
  const moduleTitleById = new Map(options.modules.map((module) => [module.id, module.title]))
  const groups = new Map<string, NotificationPreferenceModuleGroup>()

  for (const entry of listConfigurableNotificationTypes()) {
    if (!userHasScopeForPreference(options.userFeatures, entry.preference, entry.module)) {
      continue
    }

    const state = resolveEffectivePreferenceEnabled({
      notificationType: entry.type,
      storedPreferences: options.storedPreferences,
      roleFeatures: options.roleFeatures,
    })

    if (!groups.has(entry.module)) {
      groups.set(entry.module, {
        moduleId: entry.module,
        moduleTitle: moduleTitleById.get(entry.module) ?? entry.module,
        types: [],
      })
    }

    groups.get(entry.module)!.types.push({
      type: entry.type,
      labelKey: entry.preference.labelKey,
      enabled: state.enabled,
      locked: state.locked,
      audience: entry.preference.audience,
    })
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      types: group.types.sort((left, right) => left.labelKey.localeCompare(right.labelKey)),
    }))
    .filter((group) => group.types.length > 0)
    .sort((left, right) => left.moduleTitle.localeCompare(right.moduleTitle))
}

export async function saveNotificationPreferences(
  em: EntityManager,
  options: {
    userId: string
    tenantId: string
    userFeatures: string[]
    roleFeatures: string[]
    preferences: Record<string, boolean>
  },
): Promise<void> {
  const allowedTypes = new Set<string>()
  for (const entry of listConfigurableNotificationTypes()) {
    if (!userHasScopeForPreference(options.userFeatures, entry.preference, entry.module)) {
      continue
    }
    allowedTypes.add(entry.type)
  }

  await em.transactional(async (tx) => {
    for (const [notificationType, enabled] of Object.entries(options.preferences)) {
      if (!allowedTypes.has(notificationType)) continue

      const preference = resolveNotificationPreferenceDefinition(notificationType)
      if (!preference) continue
      if (isPreferenceLockedByRole(options.roleFeatures, preference)) continue

      let row = await tx.findOne(UserNotificationPreference, {
        userId: options.userId,
        tenantId: options.tenantId,
        notificationType,
      })

      if (!row) {
        row = tx.create(UserNotificationPreference, {
          userId: options.userId,
          tenantId: options.tenantId,
          notificationType,
          enabled,
        })
        tx.persist(row)
        continue
      }

      row.enabled = enabled
    }
    await tx.flush()
  })
}
