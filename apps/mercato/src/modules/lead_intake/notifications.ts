import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

export const LEAD_INTAKE_DEAL_INJECT_NOTIFY_FEATURE = 'lead_intake.deals.inject.notify'

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: 'lead_intake.deal.injected',
    module: 'lead_intake',
    titleKey: 'lead_intake.notifications.deal_injected.title',
    bodyKey: 'lead_intake.notifications.deal_injected.body',
    icon: 'briefcase',
    severity: 'info',
    userPreference: {
      labelKey: 'lead_intake.notifications.preferences.deal_injected',
      scopeFeature: 'lead_intake.submit',
      lockFeature: LEAD_INTAKE_DEAL_INJECT_NOTIFY_FEATURE,
      lockedWhenRoleGrants: true,
    },
    actions: [
      {
        id: 'open',
        labelKey: 'lead_intake.notifications.deal_injected.action.open',
        variant: 'outline',
        href: '/backend/customers/deals/{sourceEntityId}',
        icon: 'external-link',
      },
    ],
    linkHref: '/backend/customers/deals/{sourceEntityId}',
    expiresAfterHours: 168,
  },
]

export default notificationTypes
