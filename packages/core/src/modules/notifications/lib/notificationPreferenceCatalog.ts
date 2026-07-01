import type { NotificationUserPreferenceDefinition } from '@open-mercato/shared/modules/notifications/types'

export const CORE_NOTIFICATION_PREFERENCE_DEFINITIONS: Record<string, NotificationUserPreferenceDefinition> = {
  'customers.deal.won': {
    labelKey: 'customers.notifications.preferences.deal_won',
    scopeFeature: 'customers.deals.view',
  },
  'customers.deal.lost': {
    labelKey: 'customers.notifications.preferences.deal_lost',
    scopeFeature: 'customers.deals.view',
  },
  'sales.order.created': {
    labelKey: 'sales.notifications.preferences.order_created',
    scopeFeature: 'sales.orders.view',
  },
  'sales.quote.created': {
    labelKey: 'sales.notifications.preferences.quote_created',
    scopeFeature: 'sales.quotes.view',
  },
  'sales.payment.received': {
    labelKey: 'sales.notifications.preferences.payment_received',
    scopeFeature: 'sales.orders.view',
  },
  'sales.quote.expiring': {
    labelKey: 'sales.notifications.preferences.quote_expiring',
    scopeFeature: 'sales.quotes.view',
  },
  'staff.leave_request.pending': {
    labelKey: 'staff.notifications.preferences.leave_request_pending',
    scopeFeature: 'staff.leave_requests.manage',
  },
  'staff.leave_request.approved': {
    labelKey: 'staff.notifications.preferences.leave_request_approved',
    scopeFeature: 'staff.leave_requests.view',
  },
  'staff.leave_request.rejected': {
    labelKey: 'staff.notifications.preferences.leave_request_rejected',
    scopeFeature: 'staff.leave_requests.view',
  },
  'inbox_ops.proposal.created': {
    labelKey: 'inbox_ops.notifications.preferences.proposal_created',
    scopeFeature: 'inbox_ops.proposals.view',
  },
  'cases.case.closed': {
    labelKey: 'cases.notifications.preferences.case_closed',
    scopeFeature: 'cases.view',
  },
  'catalog.product.low_stock': {
    labelKey: 'catalog.notifications.preferences.product_low_stock',
    scopeFeature: 'catalog.products.view',
  },
  'business_rules.rule.execution_failed': {
    labelKey: 'business_rules.notifications.preferences.rule_execution_failed',
    scopeFeature: 'business_rules.manage',
  },
  'webhooks.delivery.failed': {
    labelKey: 'webhooks.notifications.preferences.delivery_failed',
    scopeFeature: 'webhooks.manage',
  },
  'checkout.transaction.completed': {
    labelKey: 'checkout.notifications.preferences.transaction_completed',
    scopeFeature: 'checkout.view',
  },
  'checkout.transaction.failed': {
    labelKey: 'checkout.notifications.preferences.transaction_failed',
    scopeFeature: 'checkout.view',
  },
  'checkout.link.usageLimitReached': {
    labelKey: 'checkout.notifications.preferences.usage_limit_reached',
    scopeFeature: 'checkout.view',
  },
  'workflows.task.assigned': {
    labelKey: 'workflows.notifications.preferences.task_assigned',
    scopeFeature: 'workflows.view',
  },
  'procurement.process_task.assigned': {
    labelKey: 'procurement.notifications.preferences.task_assigned',
    scopeFeature: 'procurement.processes.view',
  },
  'procurement.process.created': {
    labelKey: 'procurement.notifications.preferences.process_created',
    scopeFeature: 'procurement.processes.manage',
  },
  'playbooks.playbook.created': {
    labelKey: 'playbooks.notifications.preferences.playbook_created',
    scopeFeature: 'playbooks.edit',
  },
  'playbooks.playbook.version_published': {
    labelKey: 'playbooks.notifications.preferences.playbook_version_published',
    scopeFeature: 'playbooks.view',
  },
  'messages.new': {
    labelKey: 'messages.notifications.preferences.new_message',
    scopeFeature: 'messages.view',
  },
  'customer_accounts.user.signup': {
    labelKey: 'customer_accounts.notifications.preferences.user_signup',
    scopeFeature: 'customer_accounts.view',
  },
  'customer_accounts.user.locked': {
    labelKey: 'customer_accounts.notifications.preferences.user_locked',
    scopeFeature: 'customer_accounts.view',
  },
  'security.password.changed': {
    labelKey: 'security.notifications.preferences.password_changed',
    scopeFeature: 'security.profile.view',
  },
  'security.mfa.enrolled': {
    labelKey: 'security.notifications.preferences.mfa_enrolled',
    scopeFeature: 'security.profile.view',
  },
  'security.mfa.reset': {
    labelKey: 'security.notifications.preferences.mfa_reset',
    scopeFeature: 'security.profile.view',
  },
  'security.mfa.enforcement_deadline': {
    labelKey: 'security.notifications.preferences.mfa_enforcement_deadline',
    scopeFeature: 'security.profile.view',
  },
  'record_locks.participant.joined': {
    labelKey: 'record_locks.notifications.preferences.participant_joined',
    scopeFeature: 'record_locks.view',
  },
  'record_locks.participant.left': {
    labelKey: 'record_locks.notifications.preferences.participant_left',
    scopeFeature: 'record_locks.view',
  },
  'record_locks.lock.contended': {
    labelKey: 'record_locks.notifications.preferences.lock_contended',
    scopeFeature: 'record_locks.view',
  },
  'record_locks.lock.force_released': {
    labelKey: 'record_locks.notifications.preferences.lock_force_released',
    scopeFeature: 'record_locks.view',
  },
  'record_locks.record.deleted': {
    labelKey: 'record_locks.notifications.preferences.record_deleted',
    scopeFeature: 'record_locks.view',
  },
  'record_locks.conflict.detected': {
    labelKey: 'record_locks.notifications.preferences.conflict_detected',
    scopeFeature: 'record_locks.view',
  },
  'record_locks.incoming_changes.available': {
    labelKey: 'record_locks.notifications.preferences.incoming_changes_available',
    scopeFeature: 'record_locks.view',
  },
  'record_locks.conflict.resolved': {
    labelKey: 'record_locks.notifications.preferences.conflict_resolved',
    scopeFeature: 'record_locks.view',
  },
}
