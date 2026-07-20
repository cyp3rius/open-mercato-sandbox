import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

export const CUSTOMERS_DEAL_CREATE_NOTIFY_FEATURE = 'customers.deals.create.notify'

const dealViewAction = {
  id: 'view',
  labelKey: 'common.view',
  variant: 'outline' as const,
  href: '/backend/customers/deals/{sourceEntityId}',
  icon: 'external-link',
}

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: 'customers.deal.created',
    module: 'customers',
    titleKey: 'customers.notifications.deal.created.title',
    bodyKey: 'customers.notifications.deal.created.body',
    icon: 'briefcase',
    severity: 'info',
    userPreference: {
      labelKey: 'customers.notifications.preferences.deal_created',
      scopeFeature: CUSTOMERS_DEAL_CREATE_NOTIFY_FEATURE,
      lockFeature: CUSTOMERS_DEAL_CREATE_NOTIFY_FEATURE,
      lockedWhenRoleGrants: true,
      audience: 'global',
    },
    actions: [dealViewAction],
    linkHref: '/backend/customers/deals/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'customers.person.owner_assigned',
    module: 'customers',
    titleKey: 'customers.notifications.person.owner_assigned.title',
    bodyKey: 'customers.notifications.person.owner_assigned.body',
    icon: 'user',
    severity: 'info',
    userPreference: {
      labelKey: 'customers.notifications.preferences.person_owner_assigned',
      scopeFeature: 'customers.people.view',
      audience: 'individual',
    },
    actions: [
      {
        id: 'view',
        labelKey: 'common.view',
        variant: 'outline',
        href: '/backend/customers/people/{sourceEntityId}',
        icon: 'external-link',
      },
    ],
    linkHref: '/backend/customers/people/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'customers.company.owner_assigned',
    module: 'customers',
    titleKey: 'customers.notifications.company.owner_assigned.title',
    bodyKey: 'customers.notifications.company.owner_assigned.body',
    icon: 'building',
    severity: 'info',
    userPreference: {
      labelKey: 'customers.notifications.preferences.company_owner_assigned',
      scopeFeature: 'customers.companies.view',
      audience: 'individual',
    },
    actions: [
      {
        id: 'view',
        labelKey: 'common.view',
        variant: 'outline',
        href: '/backend/customers/companies/{sourceEntityId}',
        icon: 'external-link',
      },
    ],
    linkHref: '/backend/customers/companies/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'customers.deal.owner_assigned',
    module: 'customers',
    titleKey: 'customers.notifications.deal.owner_assigned.title',
    bodyKey: 'customers.notifications.deal.owner_assigned.body',
    icon: 'briefcase',
    severity: 'info',
    userPreference: {
      labelKey: 'customers.notifications.preferences.deal_owner_assigned',
      scopeFeature: 'customers.deals.view',
      audience: 'individual',
    },
    actions: [dealViewAction],
    linkHref: '/backend/customers/deals/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'customers.deal.won',
    module: 'customers',
    titleKey: 'customers.notifications.deal.won.title',
    bodyKey: 'customers.notifications.deal.won.body',
    icon: 'trophy',
    severity: 'success',
    userPreference: {
      labelKey: 'customers.notifications.preferences.deal_won',
      scopeFeature: 'customers.deals.view',
      audience: 'individual',
    },
    actions: [dealViewAction],
    linkHref: '/backend/customers/deals/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'customers.deal.lost',
    module: 'customers',
    titleKey: 'customers.notifications.deal.lost.title',
    bodyKey: 'customers.notifications.deal.lost.body',
    icon: 'x-circle',
    severity: 'warning',
    userPreference: {
      labelKey: 'customers.notifications.preferences.deal_lost',
      scopeFeature: 'customers.deals.view',
      audience: 'individual',
    },
    actions: [dealViewAction],
    linkHref: '/backend/customers/deals/{sourceEntityId}',
    expiresAfterHours: 168,
  },
]

export default notificationTypes
