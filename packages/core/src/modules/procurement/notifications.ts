import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

export const PROCUREMENT_PROCESS_TASK_COMPLETE_NOTIFY_FEATURE = 'procurement.process_tasks.complete.notify'

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
  {
    type: 'procurement.process_task.completed',
    module: 'procurement',
    titleKey: 'procurement.notifications.task.completed.title',
    bodyKey: 'procurement.notifications.task.completed.body',
    icon: 'clipboard-check',
    severity: 'success',
    userPreference: {
      labelKey: 'procurement.notifications.preferences.task_completed',
      scopeFeature: 'procurement.processes.view',
      lockFeature: PROCUREMENT_PROCESS_TASK_COMPLETE_NOTIFY_FEATURE,
      lockedWhenRoleGrants: true,
    },
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
  {
    type: 'procurement.process.created',
    module: 'procurement',
    titleKey: 'procurement.notifications.process.created.title',
    bodyKey: 'procurement.notifications.process.created.body',
    icon: 'package',
    severity: 'info',
    actions: [
      {
        id: 'view',
        labelKey: 'common.view',
        variant: 'outline',
        href: '/backend/procurement/processes/{sourceEntityId}',
        icon: 'external-link',
      },
    ],
    linkHref: '/backend/procurement/processes/{sourceEntityId}',
    expiresAfterHours: 168,
  },
]

export default notificationTypes
