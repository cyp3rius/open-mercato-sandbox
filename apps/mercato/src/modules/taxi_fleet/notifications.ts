import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

export const TAXI_FLEET_TRIP_ORDER_NOTIFY_FEATURE = 'taxi_fleet.trip.order.notify'
export const TAXI_FLEET_TRIP_PAID_NOTIFY_FEATURE = 'taxi_fleet.trip.paid.notify'
export const TAXI_FLEET_TRIP_CONFIRMED_NOTIFY_FEATURE = 'taxi_fleet.trip.confirmed.notify'
export const TAXI_FLEET_TRIP_CANCELLED_NOTIFY_FEATURE = 'taxi_fleet.trip.cancelled.notify'
export const TAXI_FLEET_FINANCIAL_INCOME_NOTIFY_FEATURE = 'taxi_fleet.financial.income.notify'
export const TAXI_FLEET_FINANCIAL_EXPENSE_NOTIFY_FEATURE = 'taxi_fleet.financial.expense.notify'
export const TAXI_FLEET_TRIP_SUBMITTED_NOTIFY_FEATURE = 'taxi_fleet.trip.submitted.notify'
export const TAXI_FLEET_SETTLEMENT_SUBMITTED_NOTIFY_FEATURE = 'taxi_fleet.settlement.submitted.notify'
export const TAXI_FLEET_PLATFORM_SYNC_NOTIFY_FEATURE = 'taxi_fleet.platform_sync.notify'

const tripViewAction = {
  id: 'view',
  labelKey: 'common.view',
  variant: 'outline' as const,
  href: '/backend/taxi-fleet/trips/{sourceEntityId}',
  icon: 'external-link',
}

const settlementViewAction = {
  id: 'view',
  labelKey: 'common.view',
  variant: 'outline' as const,
  href: '/backend/taxi-fleet/settlements/{sourceEntityId}',
  icon: 'external-link',
}

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: 'taxi_fleet.trip.order_created',
    module: 'taxi_fleet',
    titleKey: 'taxi_fleet.notifications.trip_order_created.title',
    bodyKey: 'taxi_fleet.notifications.trip_order_created.body',
    icon: 'car',
    severity: 'info',
    userPreference: {
      labelKey: 'taxi_fleet.notifications.preferences.trip_order_created',
      scopeFeature: 'taxi_fleet.manage_trips',
      lockFeature: TAXI_FLEET_TRIP_ORDER_NOTIFY_FEATURE,
      lockedWhenRoleGrants: true,
    },
    actions: [tripViewAction],
    linkHref: '/backend/taxi-fleet/trips/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'taxi_fleet.trip.assigned',
    module: 'taxi_fleet',
    titleKey: 'taxi_fleet.notifications.trip_assigned.title',
    bodyKey: 'taxi_fleet.notifications.trip_assigned.body',
    icon: 'user-check',
    severity: 'info',
    userPreference: {
      labelKey: 'taxi_fleet.notifications.preferences.trip_assigned',
      scopeFeature: 'taxi_fleet.view',
    },
    actions: [tripViewAction],
    linkHref: '/backend/taxi-fleet/trips/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'taxi_fleet.trip.paid',
    module: 'taxi_fleet',
    titleKey: 'taxi_fleet.notifications.trip_paid.title',
    bodyKey: 'taxi_fleet.notifications.trip_paid.body',
    icon: 'credit-card',
    severity: 'success',
    userPreference: {
      labelKey: 'taxi_fleet.notifications.preferences.trip_paid',
      scopeFeature: 'taxi_fleet.manage_trips',
      lockFeature: TAXI_FLEET_TRIP_PAID_NOTIFY_FEATURE,
      lockedWhenRoleGrants: true,
    },
    actions: [tripViewAction],
    linkHref: '/backend/taxi-fleet/trips/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'taxi_fleet.trip.confirmed',
    module: 'taxi_fleet',
    titleKey: 'taxi_fleet.notifications.trip_confirmed.title',
    bodyKey: 'taxi_fleet.notifications.trip_confirmed.body',
    icon: 'badge-check',
    severity: 'success',
    userPreference: {
      labelKey: 'taxi_fleet.notifications.preferences.trip_confirmed',
      scopeFeature: 'taxi_fleet.manage_trips',
      lockFeature: TAXI_FLEET_TRIP_CONFIRMED_NOTIFY_FEATURE,
      lockedWhenRoleGrants: true,
    },
    actions: [tripViewAction],
    linkHref: '/backend/taxi-fleet/trips/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'taxi_fleet.trip.cancelled',
    module: 'taxi_fleet',
    titleKey: 'taxi_fleet.notifications.trip_cancelled.title',
    bodyKey: 'taxi_fleet.notifications.trip_cancelled.body',
    icon: 'ban',
    severity: 'warning',
    userPreference: {
      labelKey: 'taxi_fleet.notifications.preferences.trip_cancelled',
      scopeFeature: 'taxi_fleet.manage_trips',
      lockFeature: TAXI_FLEET_TRIP_CANCELLED_NOTIFY_FEATURE,
      lockedWhenRoleGrants: true,
    },
    actions: [tripViewAction],
    linkHref: '/backend/taxi-fleet/trips/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'taxi_fleet.financial_entry.income_created',
    module: 'taxi_fleet',
    titleKey: 'taxi_fleet.notifications.financial_income_created.title',
    bodyKey: 'taxi_fleet.notifications.financial_income_created.body',
    icon: 'receipt',
    severity: 'info',
    userPreference: {
      labelKey: 'taxi_fleet.notifications.preferences.financial_income_created',
      scopeFeature: 'taxi_fleet.manage_settlements',
      lockFeature: TAXI_FLEET_FINANCIAL_INCOME_NOTIFY_FEATURE,
      lockedWhenRoleGrants: true,
    },
    actions: [
      {
        id: 'view',
        labelKey: 'common.view',
        variant: 'outline',
        href: '/backend/taxi-fleet/drivers/{driverProfileId}',
        icon: 'external-link',
      },
    ],
    linkHref: '/backend/taxi-fleet/drivers/{driverProfileId}',
    expiresAfterHours: 168,
  },
  {
    type: 'taxi_fleet.financial_entry.expense_created',
    module: 'taxi_fleet',
    titleKey: 'taxi_fleet.notifications.financial_expense_created.title',
    bodyKey: 'taxi_fleet.notifications.financial_expense_created.body',
    icon: 'wallet',
    severity: 'info',
    userPreference: {
      labelKey: 'taxi_fleet.notifications.preferences.financial_expense_created',
      scopeFeature: 'taxi_fleet.manage_settlements',
      lockFeature: TAXI_FLEET_FINANCIAL_EXPENSE_NOTIFY_FEATURE,
      lockedWhenRoleGrants: true,
    },
    actions: [
      {
        id: 'view',
        labelKey: 'common.view',
        variant: 'outline',
        href: '/backend/taxi-fleet/drivers/{driverProfileId}',
        icon: 'external-link',
      },
    ],
    linkHref: '/backend/taxi-fleet/drivers/{driverProfileId}',
    expiresAfterHours: 168,
  },
  {
    type: 'taxi_fleet.settlement.ready',
    module: 'taxi_fleet',
    titleKey: 'taxi_fleet.notifications.settlement_ready.title',
    bodyKey: 'taxi_fleet.notifications.settlement_ready.body',
    icon: 'wallet',
    severity: 'success',
    userPreference: {
      labelKey: 'taxi_fleet.notifications.preferences.settlement_ready',
      scopeFeature: 'taxi_fleet.view',
    },
    actions: [settlementViewAction],
    linkHref: '/backend/taxi-fleet/settlements/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'taxi_fleet.trip.submitted',
    module: 'taxi_fleet',
    titleKey: 'taxi_fleet.notifications.trip_submitted.title',
    bodyKey: 'taxi_fleet.notifications.trip_submitted.body',
    icon: 'car',
    severity: 'info',
    userPreference: {
      labelKey: 'taxi_fleet.notifications.preferences.trip_submitted',
      scopeFeature: 'taxi_fleet.manage_trips',
      lockFeature: TAXI_FLEET_TRIP_SUBMITTED_NOTIFY_FEATURE,
      lockedWhenRoleGrants: true,
    },
    actions: [tripViewAction],
    linkHref: '/backend/taxi-fleet/trips/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'taxi_fleet.settlement.submitted',
    module: 'taxi_fleet',
    titleKey: 'taxi_fleet.notifications.settlement_submitted.title',
    bodyKey: 'taxi_fleet.notifications.settlement_submitted.body',
    icon: 'wallet',
    severity: 'info',
    userPreference: {
      labelKey: 'taxi_fleet.notifications.preferences.settlement_submitted',
      scopeFeature: 'taxi_fleet.manage_settlements',
      lockFeature: TAXI_FLEET_SETTLEMENT_SUBMITTED_NOTIFY_FEATURE,
      lockedWhenRoleGrants: true,
    },
    actions: [
      {
        id: 'view',
        labelKey: 'common.view',
        variant: 'outline',
        href: '/backend/taxi-fleet/settlements',
        icon: 'external-link',
      },
    ],
    linkHref: '/backend/taxi-fleet/settlements',
    expiresAfterHours: 168,
  },
  {
    type: 'taxi_fleet.platform_sync.completed',
    module: 'taxi_fleet',
    titleKey: 'taxi_fleet.notifications.platform_sync_completed.title',
    bodyKey: 'taxi_fleet.notifications.platform_sync_completed.body',
    icon: 'upload',
    severity: 'info',
    userPreference: {
      labelKey: 'taxi_fleet.notifications.preferences.platform_sync_completed',
      scopeFeature: 'taxi_fleet.manage_platform_sync',
      lockFeature: TAXI_FLEET_PLATFORM_SYNC_NOTIFY_FEATURE,
      lockedWhenRoleGrants: true,
    },
    actions: [
      {
        id: 'view',
        labelKey: 'common.view',
        variant: 'outline',
        href: '/backend/taxi-fleet/trips',
        icon: 'external-link',
      },
    ],
    linkHref: '/backend/taxi-fleet/trips',
    expiresAfterHours: 72,
  },
]

export default notificationTypes
