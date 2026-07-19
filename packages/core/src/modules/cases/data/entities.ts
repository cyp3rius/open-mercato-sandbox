import { Entity, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core'

@Entity({ tableName: 'cases_cases' })
@Index({ name: 'cases_cases_scope_idx', properties: ['tenantId', 'organizationId'] })
@Index({ name: 'cases_cases_customer_idx', properties: ['customerEntityId'] })
@Index({ name: 'cases_cases_owner_idx', properties: ['ownerUserId'] })
@Index({ name: 'cases_cases_status_idx', properties: ['statusValue'] })
@Index({ name: 'cases_cases_due_idx', properties: ['dueAt'] })
@Index({ name: 'cases_cases_recurrence_series_idx', properties: ['recurrenceSeriesId'] })
@Unique({
  name: 'cases_cases_recurrence_occurrence_unique',
  properties: ['recurrenceSeriesId', 'recurrenceOccurrenceKey'],
})
export class ServiceCase {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ type: 'text' })
  title!: string

  @Property({ name: 'status_value', type: 'text' })
  statusValue!: string

  @Property({ name: 'status_label', type: 'text', nullable: true })
  statusLabel?: string | null

  @Property({ name: 'status_color', type: 'text', nullable: true })
  statusColor?: string | null

  @Property({ name: 'customer_entity_id', type: 'uuid' })
  customerEntityId!: string

  @Property({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId?: string | null

  @Property({ name: 'procurement_process_id', type: 'uuid', nullable: true })
  procurementProcessId?: string | null

  @Property({ name: 'insurance_policy_id', type: 'uuid', nullable: true })
  insurancePolicyId?: string | null

  @Property({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId?: string | null

  @Property({ name: 'opened_at', type: Date })
  openedAt!: Date

  @Property({ name: 'closed_at', type: Date, nullable: true })
  closedAt?: Date | null

  @Property({ name: 'due_at', type: Date, nullable: true })
  dueAt?: Date | null

  @Property({ name: 'overdue_notified_at', type: Date, nullable: true })
  overdueNotifiedAt?: Date | null

  @Property({ name: 'recurrence_enabled', type: 'boolean', default: false })
  recurrenceEnabled: boolean = false

  @Property({ name: 'recurrence_series_id', type: 'uuid', nullable: true })
  recurrenceSeriesId?: string | null

  @Property({ name: 'recurrence_interval_amount', type: 'int', nullable: true })
  recurrenceIntervalAmount?: number | null

  @Property({ name: 'recurrence_interval_unit', type: 'text', nullable: true })
  recurrenceIntervalUnit?: string | null

  @Property({ name: 'recurrence_create_lead_time', type: 'json', nullable: true })
  recurrenceCreateLeadTime?: { amount: number; unit: string } | null

  @Property({ name: 'recurrence_occurrence_key', type: 'text', nullable: true })
  recurrenceOccurrenceKey?: string | null

  @Property({ name: 'recurrence_next_occurrence_at', type: Date, nullable: true })
  recurrenceNextOccurrenceAt?: Date | null

  @Property({ type: 'text' })
  priority: string = 'normal'

  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, unknown> | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'cases_timeline_events' })
@Index({ name: 'cases_timeline_case_idx', properties: ['caseRecord'] })
@Index({ name: 'cases_timeline_occurred_idx', properties: ['occurredAt'] })
export class CaseTimelineEvent {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @ManyToOne(() => ServiceCase, { fieldName: 'case_id' })
  caseRecord!: ServiceCase

  @Property({ name: 'event_type', type: 'text' })
  eventType!: string

  @Property({ type: 'text' })
  body!: string

  @Property({ name: 'occurred_at', type: Date })
  occurredAt!: Date

  @Property({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId?: string | null

  @Property({ name: 'source_ref', type: 'json', nullable: true })
  sourceRef?: Record<string, unknown> | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
