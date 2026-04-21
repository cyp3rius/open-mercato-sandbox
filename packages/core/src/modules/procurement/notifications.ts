import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: 'procurement.process_task.assigned',
    module: 'procurement',
    titleKey: 'procurement.notifications.task.assigned.title',
    bodyKey: 'procurement.notifications.task.assigned.body',
    icon: 'clipboard-list',
    severity: 'info',
    actions: [
      {
        id: 'view',
        labelKey: 'common.view',
        variant: 'outline',
        href: '/backend/procurement/processes/{sourceEntityId}?tab=tasks',
        icon: 'external-link',
      },
    ],
    linkHref: '/backend/procurement/processes/{sourceEntityId}?tab=tasks',
    expiresAfterHours: 168,
  },
]

export default notificationTypes
