import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: 'playbooks.playbook.created',
    module: 'playbooks',
    titleKey: 'playbooks.notifications.playbook.created.title',
    bodyKey: 'playbooks.notifications.playbook.created.body',
    icon: 'book-open',
    severity: 'info',
    actions: [
      {
        id: 'open',
        labelKey: 'playbooks.notifications.actions.openPlaybook',
        variant: 'outline',
        href: '/backend/playbooks/{sourceEntityId}',
        icon: 'external-link',
      },
    ],
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
    actions: [
      {
        id: 'open',
        labelKey: 'playbooks.notifications.actions.openPlaybook',
        variant: 'outline',
        href: '/backend/playbooks/{sourceEntityId}',
        icon: 'external-link',
      },
    ],
    linkHref: '/backend/playbooks/{sourceEntityId}',
    expiresAfterHours: 168,
  },
]

export default notificationTypes
