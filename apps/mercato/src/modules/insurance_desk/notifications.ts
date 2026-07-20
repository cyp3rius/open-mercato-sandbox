import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

export const INSURANCE_DESK_LEAD_INJECT_NOTIFY_FEATURE = 'insurance_desk.leads.inject.notify'
export const INSURANCE_DESK_POLICY_FROM_ENQUIRY_NOTIFY_FEATURE = 'insurance_desk.policies.from_enquiry.notify'
export const INSURANCE_DESK_POLICY_EXPIRING_ALL_NOTIFY_FEATURE = 'insurance_desk.policies.expiring.notify'

const policyViewAction = {
  id: 'open-policy',
  labelKey: 'insurance_desk.policies.viewDetails',
  variant: 'outline' as const,
  href: '/backend/insurance-desk/policies/{sourceEntityId}',
  icon: 'external-link',
}

export const notificationTypes: NotificationTypeDefinition[] = [
  {
    type: 'insurance_desk.lead.injected',
    module: 'insurance_desk',
    titleKey: 'insurance_desk.notifications.lead_injected.title',
    bodyKey: 'insurance_desk.notifications.lead_injected.body',
    icon: 'file-text',
    severity: 'info',
    userPreference: {
      labelKey: 'insurance_desk.notifications.preferences.lead_injected',
      scopeFeature: INSURANCE_DESK_LEAD_INJECT_NOTIFY_FEATURE,
      lockFeature: INSURANCE_DESK_LEAD_INJECT_NOTIFY_FEATURE,
      lockedWhenRoleGrants: true,
      audience: 'global',
    },
    actions: [
      {
        id: 'open',
        labelKey: 'insurance_desk.leads.viewDetails',
        variant: 'outline',
        href: '/backend/insurance-desk/leads/{sourceEntityId}',
        icon: 'external-link',
      },
    ],
    linkHref: '/backend/insurance-desk/leads/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'insurance_desk.policy.from_enquiry',
    module: 'insurance_desk',
    titleKey: 'insurance_desk.notifications.policy_from_enquiry.title',
    bodyKey: 'insurance_desk.notifications.policy_from_enquiry.body',
    icon: 'shield',
    severity: 'success',
    userPreference: {
      labelKey: 'insurance_desk.notifications.preferences.policy_from_enquiry',
      scopeFeature: INSURANCE_DESK_POLICY_FROM_ENQUIRY_NOTIFY_FEATURE,
      lockFeature: INSURANCE_DESK_POLICY_FROM_ENQUIRY_NOTIFY_FEATURE,
      lockedWhenRoleGrants: true,
      audience: 'global',
    },
    actions: [policyViewAction],
    linkHref: '/backend/insurance-desk/policies/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'insurance_desk.policy.expiring.all',
    module: 'insurance_desk',
    titleKey: 'insurance_desk.notifications.policy_expiring.all.title',
    bodyKey: 'insurance_desk.notifications.policy_expiring.all.body',
    icon: 'shield',
    severity: 'warning',
    userPreference: {
      labelKey: 'insurance_desk.notifications.preferences.policy_expiring_all',
      scopeFeature: INSURANCE_DESK_POLICY_EXPIRING_ALL_NOTIFY_FEATURE,
      lockFeature: INSURANCE_DESK_POLICY_EXPIRING_ALL_NOTIFY_FEATURE,
      lockedWhenRoleGrants: true,
      audience: 'global',
    },
    actions: [policyViewAction],
    linkHref: '/backend/insurance-desk/policies/{sourceEntityId}',
    expiresAfterHours: 168,
  },
  {
    type: 'insurance_desk.policy.expiring.my',
    module: 'insurance_desk',
    titleKey: 'insurance_desk.notifications.policy_expiring.my.title',
    bodyKey: 'insurance_desk.notifications.policy_expiring.my.body',
    icon: 'shield',
    severity: 'warning',
    userPreference: {
      labelKey: 'insurance_desk.notifications.preferences.policy_expiring_my',
      scopeFeature: 'insurance.policies.view',
      audience: 'individual',
    },
    actions: [policyViewAction],
    linkHref: '/backend/insurance-desk/policies/{sourceEntityId}',
    expiresAfterHours: 168,
  },
]

export default notificationTypes
