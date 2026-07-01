import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

export const CASES_CASE_CREATE_NOTIFY_FEATURE = 'cases.cases.create.notify'

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: 'cases.case.created',
    module: 'cases',
    titleKey: 'cases.notifications.case.created.title',
    bodyKey: 'cases.notifications.case.created.body',
    icon: 'briefcase',
    severity: 'info',
    userPreference: {
      labelKey: 'cases.notifications.preferences.case_created',
      scopeFeature: 'cases.view',
      lockFeature: CASES_CASE_CREATE_NOTIFY_FEATURE,
      lockedWhenRoleGrants: true,
    },
    actions: [
      {
        id: 'open',
        labelKey: 'cases.list.actions.viewDetails',
        variant: 'outline',
        href: '/backend/cases/{sourceEntityId}',
        icon: 'external-link',
      },
    ],
    linkHref: '/backend/cases/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'cases.case.closed',
    module: 'cases',
    titleKey: 'cases.notifications.case.closed.title',
    bodyKey: 'cases.notifications.case.closed.body',
    icon: 'briefcase',
    severity: 'info',
    actions: [
      {
        id: 'open',
        labelKey: 'cases.list.actions.viewDetails',
        variant: 'outline',
        href: '/backend/cases/{sourceEntityId}',
        icon: 'external-link',
      },
    ],
    linkHref: '/backend/cases/{sourceEntityId}',
    expiresAfterHours: 168,
  },
]

export default notificationTypes
