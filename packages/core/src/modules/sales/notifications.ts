import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

export const SALES_QUOTE_CREATE_NOTIFY_FEATURE = 'sales.quotes.create.notify'
export const SALES_ORDER_CREATE_NOTIFY_FEATURE = 'sales.orders.create.notify'
export const SALES_PAYMENT_RECEIVED_NOTIFY_FEATURE = 'sales.payments.received.notify'
export const SALES_QUOTE_EXPIRING_NOTIFY_FEATURE = 'sales.quotes.expiring.notify'

const quoteViewAction = {
  id: 'view',
  labelKey: 'common.view',
  variant: 'outline' as const,
  href: '/backend/sales/quotes/{sourceEntityId}',
  icon: 'external-link',
}

const orderViewAction = {
  id: 'view',
  labelKey: 'common.view',
  variant: 'outline' as const,
  href: '/backend/sales/orders/{sourceEntityId}',
  icon: 'external-link',
}

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: 'sales.order.created',
    module: 'sales',
    titleKey: 'sales.notifications.order.created.title',
    bodyKey: 'sales.notifications.order.created.body',
    icon: 'shopping-cart',
    severity: 'info',
    userPreference: {
      labelKey: 'sales.notifications.preferences.order_created',
      scopeFeature: SALES_ORDER_CREATE_NOTIFY_FEATURE,
      lockFeature: SALES_ORDER_CREATE_NOTIFY_FEATURE,
      lockedWhenRoleGrants: true,
      audience: 'global',
    },
    actions: [orderViewAction],
    linkHref: '/backend/sales/orders/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'sales.order.owner_assigned',
    module: 'sales',
    titleKey: 'sales.notifications.order.owner_assigned.title',
    bodyKey: 'sales.notifications.order.owner_assigned.body',
    icon: 'shopping-cart',
    severity: 'info',
    userPreference: {
      labelKey: 'sales.notifications.preferences.order_owner_assigned',
      scopeFeature: 'sales.orders.view',
      audience: 'individual',
    },
    actions: [orderViewAction],
    linkHref: '/backend/sales/orders/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'sales.quote.created',
    module: 'sales',
    titleKey: 'sales.notifications.quote.created.title',
    bodyKey: 'sales.notifications.quote.created.body',
    icon: 'file-text',
    severity: 'info',
    userPreference: {
      labelKey: 'sales.notifications.preferences.quote_created',
      scopeFeature: SALES_QUOTE_CREATE_NOTIFY_FEATURE,
      lockFeature: SALES_QUOTE_CREATE_NOTIFY_FEATURE,
      lockedWhenRoleGrants: true,
      audience: 'global',
    },
    actions: [quoteViewAction],
    linkHref: '/backend/sales/quotes/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'sales.quote.owner_assigned',
    module: 'sales',
    titleKey: 'sales.notifications.quote.owner_assigned.title',
    bodyKey: 'sales.notifications.quote.owner_assigned.body',
    icon: 'file-text',
    severity: 'info',
    userPreference: {
      labelKey: 'sales.notifications.preferences.quote_owner_assigned',
      scopeFeature: 'sales.quotes.view',
      audience: 'individual',
    },
    actions: [quoteViewAction],
    linkHref: '/backend/sales/quotes/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'sales.payment.received',
    module: 'sales',
    titleKey: 'sales.notifications.payment.received.title',
    bodyKey: 'sales.notifications.payment.received.body',
    icon: 'credit-card',
    severity: 'success',
    userPreference: {
      labelKey: 'sales.notifications.preferences.payment_received',
      scopeFeature: SALES_PAYMENT_RECEIVED_NOTIFY_FEATURE,
      lockFeature: SALES_PAYMENT_RECEIVED_NOTIFY_FEATURE,
      lockedWhenRoleGrants: true,
      audience: 'global',
    },
    actions: [orderViewAction],
    linkHref: '/backend/sales/orders/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'sales.quote.expiring',
    module: 'sales',
    titleKey: 'sales.notifications.quote.expiring.title',
    bodyKey: 'sales.notifications.quote.expiring.body',
    icon: 'clock',
    severity: 'warning',
    userPreference: {
      labelKey: 'sales.notifications.preferences.quote_expiring',
      scopeFeature: SALES_QUOTE_EXPIRING_NOTIFY_FEATURE,
      lockFeature: SALES_QUOTE_EXPIRING_NOTIFY_FEATURE,
      lockedWhenRoleGrants: true,
      audience: 'global',
    },
    actions: [quoteViewAction],
    linkHref: '/backend/sales/quotes/{sourceEntityId}',
    expiresAfterHours: 72,
  },
  {
    type: 'sales.quote.expiring.owner',
    module: 'sales',
    titleKey: 'sales.notifications.quote.expiring.title',
    bodyKey: 'sales.notifications.quote.expiring.body',
    icon: 'clock',
    severity: 'warning',
    userPreference: {
      labelKey: 'sales.notifications.preferences.quote_expiring_owner',
      scopeFeature: 'sales.quotes.view',
      audience: 'individual',
    },
    actions: [quoteViewAction],
    linkHref: '/backend/sales/quotes/{sourceEntityId}',
    expiresAfterHours: 72,
  },
]

export default notificationTypes
