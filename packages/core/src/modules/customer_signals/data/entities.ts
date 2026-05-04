import { Entity, Index, PrimaryKey, Property } from '@mikro-orm/core'

@Entity({ tableName: 'customer_signals_signals' })
@Index({ name: 'customer_signals_customer_time_idx', properties: ['customerEntityId', 'occurredAt'] })
@Index({ name: 'customer_signals_type_time_idx', properties: ['signalType', 'occurredAt'] })
export class CustomerSignal {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'customer_entity_id', type: 'uuid' })
  customerEntityId!: string

  @Property({ name: 'signal_type', type: 'text' })
  signalType!: string

  @Property({ type: 'text' })
  source!: string

  @Property({ name: 'subject_entity_type', type: 'text', nullable: true })
  subjectEntityType?: string | null

  @Property({ name: 'subject_entity_id', type: 'uuid', nullable: true })
  subjectEntityId?: string | null

  @Property({ type: 'json', nullable: true })
  payload?: Record<string, unknown> | null

  @Property({ name: 'occurred_at', type: Date })
  occurredAt!: Date

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()
}
