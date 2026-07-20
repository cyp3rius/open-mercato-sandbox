import type { NotificationUserPreferenceDefinition } from '@open-mercato/shared/modules/notifications/types'

export const CORE_NOTIFICATION_PREFERENCE_DEFINITIONS: Record<string, NotificationUserPreferenceDefinition> = {
  'customers.deal.created': {
    labelKey: 'customers.notifications.preferences.deal_created',
    scopeFeature: 'customers.deals.create.notify',
    lockFeature: 'customers.deals.create.notify',
    lockedWhenRoleGrants: true,
    audience: 'global',
  },
  'customers.person.owner_assigned': {
    labelKey: 'customers.notifications.preferences.person_owner_assigned',
    scopeFeature: 'customers.people.view',
    audience: 'individual',
  },
  'customers.company.owner_assigned': {
    labelKey: 'customers.notifications.preferences.company_owner_assigned',
    scopeFeature: 'customers.companies.view',
    audience: 'individual',
  },
  'customers.deal.owner_assigned': {
    labelKey: 'customers.notifications.preferences.deal_owner_assigned',
    scopeFeature: 'customers.deals.view',
    audience: 'individual',
  },
  'customers.deal.won': {
    labelKey: 'customers.notifications.preferences.deal_won',
    scopeFeature: 'customers.deals.view',
    audience: 'individual',
  },
  'customers.deal.lost': {
    labelKey: 'customers.notifications.preferences.deal_lost',
    scopeFeature: 'customers.deals.view',
    audience: 'individual',
  },
  'sales.order.created': {
    labelKey: 'sales.notifications.preferences.order_created',
    scopeFeature: 'sales.orders.create.notify',
    lockFeature: 'sales.orders.create.notify',
    lockedWhenRoleGrants: true,
    audience: 'global',
  },
  'sales.order.owner_assigned': {
    labelKey: 'sales.notifications.preferences.order_owner_assigned',
    scopeFeature: 'sales.orders.view',
    audience: 'individual',
  },
  'sales.quote.created': {
    labelKey: 'sales.notifications.preferences.quote_created',
    scopeFeature: 'sales.quotes.create.notify',
    lockFeature: 'sales.quotes.create.notify',
    lockedWhenRoleGrants: true,
    audience: 'global',
  },
  'sales.quote.owner_assigned': {
    labelKey: 'sales.notifications.preferences.quote_owner_assigned',
    scopeFeature: 'sales.quotes.view',
    audience: 'individual',
  },
  'sales.payment.received': {
    labelKey: 'sales.notifications.preferences.payment_received',
    scopeFeature: 'sales.payments.received.notify',
    lockFeature: 'sales.payments.received.notify',
    lockedWhenRoleGrants: true,
    audience: 'global',
  },
  'sales.quote.expiring': {
    labelKey: 'sales.notifications.preferences.quote_expiring',
    scopeFeature: 'sales.quotes.expiring.notify',
    lockFeature: 'sales.quotes.expiring.notify',
    lockedWhenRoleGrants: true,
    audience: 'global',
  },
  'sales.quote.expiring.owner': {
    labelKey: 'sales.notifications.preferences.quote_expiring_owner',
    scopeFeature: 'sales.quotes.view',
    audience: 'individual',
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
  'cases.case.created': {
    labelKey: 'cases.notifications.preferences.case_created',
    scopeFeature: 'cases.cases.create.notify',
    lockFeature: 'cases.cases.create.notify',
    lockedWhenRoleGrants: true,
    audience: 'global',
  },
  'cases.case.created.owner': {
    labelKey: 'cases.notifications.preferences.case_created_owner',
    scopeFeature: 'cases.view',
    audience: 'individual',
  },
  'cases.case.closed': {
    labelKey: 'cases.notifications.preferences.case_closed',
    scopeFeature: 'cases.cases.closed.notify',
    lockFeature: 'cases.cases.closed.notify',
    lockedWhenRoleGrants: true,
    audience: 'global',
  },
  'cases.case.closed.owner': {
    labelKey: 'cases.notifications.preferences.case_closed_owner',
    scopeFeature: 'cases.view',
    audience: 'individual',
  },
  'cases.case.overdue': {
    labelKey: 'cases.notifications.preferences.case_overdue',
    scopeFeature: 'cases.cases.overdue.notify',
    lockFeature: 'cases.cases.overdue.notify',
    lockedWhenRoleGrants: true,
    audience: 'global',
  },
  'cases.case.overdue.owner': {
    labelKey: 'cases.notifications.preferences.case_overdue_owner',
    scopeFeature: 'cases.view',
    audience: 'individual',
  },
  'cases.case.stage_owner_assigned': {
    labelKey: 'cases.notifications.preferences.case_stage_owner_assigned',
    scopeFeature: 'cases.view',
    audience: 'individual',
  },
  'cases.procedure.action_notify': {
    labelKey: 'cases.notifications.preferences.procedure_action_notify',
    scopeFeature: 'cases.view',
    audience: 'individual',
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
    audience: 'individual',
  },
  'procurement.process.handler_assigned': {
    labelKey: 'procurement.notifications.preferences.process_handler_assigned',
    scopeFeature: 'procurement.processes.view',
    audience: 'individual',
  },
  'procurement.process.created': {
    labelKey: 'procurement.notifications.preferences.process_created',
    scopeFeature: 'procurement.processes.manage',
  },
  'playbooks.playbook.created': {
    labelKey: 'playbooks.notifications.preferences.playbook_created',
    scopeFeature: 'playbooks.playbook.created.notify',
    lockFeature: 'playbooks.playbook.created.notify',
    lockedWhenRoleGrants: true,
    audience: 'global',
  },
  'playbooks.playbook.version_published': {
    labelKey: 'playbooks.notifications.preferences.playbook_version_published',
    scopeFeature: 'playbooks.playbook.version_published.notify',
    lockFeature: 'playbooks.playbook.version_published.notify',
    lockedWhenRoleGrants: true,
    audience: 'global',
  },
  'messages.new': {
    labelKey: 'messages.notifications.preferences.new_message',
    scopeFeature: 'messages.view',
  },
  'insurance_desk.lead.injected': {
    labelKey: 'insurance_desk.notifications.preferences.lead_injected',
    scopeFeature: 'insurance_desk.leads.inject.notify',
    lockFeature: 'insurance_desk.leads.inject.notify',
    lockedWhenRoleGrants: true,
    audience: 'global',
  },
  'insurance_desk.policy.from_enquiry': {
    labelKey: 'insurance_desk.notifications.preferences.policy_from_enquiry',
    scopeFeature: 'insurance_desk.policies.from_enquiry.notify',
    lockFeature: 'insurance_desk.policies.from_enquiry.notify',
    lockedWhenRoleGrants: true,
    audience: 'global',
  },
  'insurance_desk.policy.expiring.all': {
    labelKey: 'insurance_desk.notifications.preferences.policy_expiring_all',
    scopeFeature: 'insurance_desk.policies.expiring.notify',
    lockFeature: 'insurance_desk.policies.expiring.notify',
    lockedWhenRoleGrants: true,
    audience: 'global',
  },
  'insurance_desk.policy.expiring.my': {
    labelKey: 'insurance_desk.notifications.preferences.policy_expiring_my',
    scopeFeature: 'insurance.policies.view',
    audience: 'individual',
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
