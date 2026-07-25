import { Entity, Index, ManyToOne, PrimaryKey, Property } from '@mikro-orm/core'

@Entity({ tableName: 'partner_programs' })
@Index({ name: 'partner_programs_scope_idx', properties: ['tenantId', 'organizationId'] })
export class PartnerProgram {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'valid_from', type: Date, nullable: true })
  validFrom?: Date | null

  @Property({ name: 'valid_to', type: Date, nullable: true })
  validTo?: Date | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  /** Percent of order grand total (0–100), base selected via incentiveBase. */
  @Property({ name: 'incentive_percent', type: 'numeric', precision: 7, scale: 4, default: '0' })
  incentivePercent: string = '0'

  /** Whether incentive % applies to order net or gross total. */
  @Property({ name: 'incentive_base', type: 'text', default: 'net' })
  incentiveBase: string = 'net'

  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, unknown> | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'partner_programs_memberships' })
@Index({ name: 'partner_programs_memberships_program_idx', properties: ['program'] })
@Index({ name: 'partner_programs_memberships_customer_idx', properties: ['customerEntityId'] })
export class PartnerProgramMembership {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @ManyToOne(() => PartnerProgram, { fieldName: 'program_id' })
  program!: PartnerProgram

  @Property({ name: 'customer_entity_id', type: 'uuid' })
  customerEntityId!: string

  @Property({ type: 'text', nullable: true })
  role?: string | null

  @Property({ name: 'joined_at', type: Date, onCreate: () => new Date() })
  joinedAt: Date = new Date()

  @Property({ name: 'left_at', type: Date, nullable: true })
  leftAt?: Date | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

export type PartnerIncentiveLedgerKind = 'accrual' | 'payout'

@Entity({ tableName: 'partner_programs_incentive_ledger' })
@Index({
  name: 'partner_programs_incentive_ledger_customer_scope_idx',
  properties: ['customerEntityId', 'organizationId', 'tenantId'],
})
@Index({ name: 'partner_programs_incentive_ledger_order_idx', properties: ['salesOrderId'] })
export class PartnerIncentiveLedgerEntry {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'customer_entity_id', type: 'uuid' })
  customerEntityId!: string

  @Property({ name: 'program_id', type: 'uuid', nullable: true })
  programId?: string | null

  @Property({ type: 'text' })
  kind!: PartnerIncentiveLedgerKind

  @Property({ type: 'numeric', precision: 18, scale: 4 })
  amount!: string

  @Property({ name: 'currency_code', type: 'text' })
  currencyCode!: string

  @Property({ name: 'sales_order_id', type: 'uuid', nullable: true })
  salesOrderId?: string | null

  @Property({ name: 'rate_percent', type: 'numeric', precision: 7, scale: 4, nullable: true })
  ratePercent?: string | null

  @Property({ name: 'base_amount', type: 'numeric', precision: 18, scale: 4, nullable: true })
  baseAmount?: string | null

  @Property({ type: 'text', nullable: true })
  note?: string | null

  @Property({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
