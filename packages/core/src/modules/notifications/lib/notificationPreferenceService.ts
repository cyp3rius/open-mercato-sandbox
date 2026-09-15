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

export type StoredPreferenceChannels = {
  enabled: boolean
  pushEnabled: boolean | null
}

export async function getStoredPreferenceChannelMap(
  em: EntityManager,
  userId: string,
  tenantId: string,
): Promise<Map<string, StoredPreferenceChannels>> {
  const rows = await em.find(UserNotificationPreference, { userId, tenantId })
  return new Map(
    rows.map((row) => [
      row.notificationType,
      { enabled: row.enabled, pushEnabled: row.pushEnabled ?? null },
    ]),
  )
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

export function resolveEffectivePushPreference(options: {
  notificationType: string
  storedPushPreferences: Map<string, boolean | null>
}): { enabled: boolean; locked: boolean; hasPushChannel: boolean } {
  const preference = resolveNotificationPreferenceDefinition(options.notificationType)
  const pushChannel = preference?.pushChannel
  if (!pushChannel) {
    return { enabled: false, locked: false, hasPushChannel: false }
  }
  if (pushChannel.locked) {
    return { enabled: true, locked: true, hasPushChannel: true }
  }
  if (options.storedPushPreferences.has(options.notificationType)) {
    const stored = options.storedPushPreferences.get(options.notificationType)
    if (stored === null || stored === undefined) {
      return {
        enabled: pushChannel.defaultEnabled ?? true,
        locked: false,
        hasPushChannel: true,
      }
    }
    return { enabled: stored === true, locked: false, hasPushChannel: true }
  }
  return {
    enabled: pushChannel.defaultEnabled ?? true,
    locked: false,
    hasPushChannel: true,
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

/** Gate for OS/Web Push. Types without pushChannel never deliver push. Locked channel always delivers. */
export async function shouldDeliverPush(
  em: EntityManager,
  userId: string,
  tenantId: string,
  notificationType: string,
): Promise<boolean> {
  const preference = resolveNotificationPreferenceDefinition(notificationType)
  if (!preference?.pushChannel) return false
  if (preference.pushChannel.locked) return true

  const channelMap = await getStoredPreferenceChannelMap(em, userId, tenantId)
  const stored = channelMap.get(notificationType)?.pushEnabled ?? null
  const storedPush = new Map<string, boolean | null>([[notificationType, stored]])
  return resolveEffectivePushPreference({
    notificationType,
    storedPushPreferences: storedPush,
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
    hasPushChannel: boolean
    pushEnabled: boolean
    pushLocked: boolean
  }>
}

export function buildNotificationPreferenceGroups(options: {
  userFeatures: string[]
  roleFeatures: string[]
  storedPreferences: Map<string, boolean>
  storedPushPreferences?: Map<string, boolean | null>
  modules: Array<{ id: string; title: string }>
}): NotificationPreferenceModuleGroup[] {
  const moduleTitleById = new Map(options.modules.map((module) => [module.id, module.title]))
  const groups = new Map<string, NotificationPreferenceModuleGroup>()
  const storedPush = options.storedPushPreferences ?? new Map<string, boolean | null>()

  for (const entry of listConfigurableNotificationTypes()) {
    if (!userHasScopeForPreference(options.userFeatures, entry.preference, entry.module)) {
      continue
    }

    const state = resolveEffectivePreferenceEnabled({
      notificationType: entry.type,
      storedPreferences: options.storedPreferences,
      roleFeatures: options.roleFeatures,
    })
    const pushState = resolveEffectivePushPreference({
      notificationType: entry.type,
      storedPushPreferences: storedPush,
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
      hasPushChannel: pushState.hasPushChannel,
      pushEnabled: pushState.enabled,
      pushLocked: pushState.locked,
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
    pushPreferences?: Record<string, boolean>
  },
): Promise<void> {
  const allowedTypes = new Set<string>()
  const pushAllowedTypes = new Set<string>()
  for (const entry of listConfigurableNotificationTypes()) {
    if (!userHasScopeForPreference(options.userFeatures, entry.preference, entry.module)) {
      continue
    }
    allowedTypes.add(entry.type)
    if (entry.preference.pushChannel && !entry.preference.pushChannel.locked) {
      pushAllowedTypes.add(entry.type)
    }
  }

  await em.transactional(async (tx) => {
    const touchedTypes = new Set([
      ...Object.keys(options.preferences),
      ...Object.keys(options.pushPreferences ?? {}),
    ])

    for (const notificationType of touchedTypes) {
      if (!allowedTypes.has(notificationType)) continue

      const preference = resolveNotificationPreferenceDefinition(notificationType)
      if (!preference) continue

      const inAppLocked = isPreferenceLockedByRole(options.roleFeatures, preference)
      const hasInAppUpdate =
        Object.prototype.hasOwnProperty.call(options.preferences, notificationType) && !inAppLocked
      const hasPushUpdate =
        options.pushPreferences != null &&
        Object.prototype.hasOwnProperty.call(options.pushPreferences, notificationType) &&
        pushAllowedTypes.has(notificationType)

      if (!hasInAppUpdate && !hasPushUpdate) continue

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
          enabled: hasInAppUpdate ? options.preferences[notificationType]! : (preference.defaultEnabled ?? true),
          pushEnabled: hasPushUpdate ? options.pushPreferences![notificationType]! : null,
        })
        tx.persist(row)
        continue
      }

      if (hasInAppUpdate) row.enabled = options.preferences[notificationType]!
      if (hasPushUpdate) row.pushEnabled = options.pushPreferences![notificationType]!
      row.updatedAt = new Date()
    }
    await tx.flush()
  })
}
