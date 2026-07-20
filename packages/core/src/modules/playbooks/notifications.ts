import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

export const PLAYBOOKS_CREATED_NOTIFY_FEATURE = 'playbooks.playbook.created.notify'
export const PLAYBOOKS_VERSION_PUBLISHED_NOTIFY_FEATURE = 'playbooks.playbook.version_published.notify'

const playbookViewAction = {
  id: 'open',
  labelKey: 'playbooks.notifications.actions.openPlaybook',
  variant: 'outline' as const,
  href: '/backend/playbooks/{sourceEntityId}',
  icon: 'external-link',
}

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: 'playbooks.playbook.created',
    module: 'playbooks',
    titleKey: 'playbooks.notifications.playbook.created.title',
    bodyKey: 'playbooks.notifications.playbook.created.body',
    icon: 'book-open',
    severity: 'info',
    userPreference: {
      labelKey: 'playbooks.notifications.preferences.playbook_created',
      scopeFeature: PLAYBOOKS_CREATED_NOTIFY_FEATURE,
      lockFeature: PLAYBOOKS_CREATED_NOTIFY_FEATURE,
      lockedWhenRoleGrants: true,
      audience: 'global',
    },
    actions: [playbookViewAction],
    linkHref: '/backend/playbooks/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'playbooks.playbook.version_published',
    module: 'playbooks',
    titleKey: 'playbooks.notifications.playbook.versionPublished.title',
    bodyKey: 'playbooks.notifications.playbook.versionPublished.body',
    icon: 'book-open',
    severity: 'info',
    userPreference: {
      labelKey: 'playbooks.notifications.preferences.playbook_version_published',
      scopeFeature: PLAYBOOKS_VERSION_PUBLISHED_NOTIFY_FEATURE,
      lockFeature: PLAYBOOKS_VERSION_PUBLISHED_NOTIFY_FEATURE,
      lockedWhenRoleGrants: true,
      audience: 'global',
    },
    actions: [playbookViewAction],
    linkHref: '/backend/playbooks/{sourceEntityId}',
    expiresAfterHours: 168,
  },
]

export default notificationTypes
