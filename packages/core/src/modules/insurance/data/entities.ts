import { Entity, Index, ManyToOne, OptionalProps, PrimaryKey, Property, Unique } from '@mikro-orm/core'

@Entity({ tableName: 'insurance_insurers' })
@Index({ name: 'insurance_insurers_scope_idx', properties: ['organizationId', 'tenantId'] })
export class InsuranceInsurer {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ type: 'text' })
  code!: string

  @Property({ type: 'text' })
  name!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'insurance_insurer_contacts' })
@Index({ name: 'insurance_insurer_contacts_insurer_idx', properties: ['insurer', 'organizationId', 'tenantId'] })
export class InsuranceInsurerContact {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @ManyToOne(() => InsuranceInsurer, { fieldName: 'insurer_id', deleteRule: 'cascade' })
  insurer!: InsuranceInsurer

  @Property({ name: 'full_name', type: 'text' })
  fullName!: string

  @Property({ type: 'text', nullable: true })
  email?: string | null

  @Property({ type: 'text', nullable: true })
  phone?: string | null

  @Property({ type: 'text', nullable: true })
  role?: string | null

  @Property({ name: 'is_default', type: 'boolean', default: false })
  isDefault: boolean = false

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'insurance_policies' })
@Index({ name: 'insurance_policies_scope_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'insurance_policies_partner_idx', properties: ['referringPartnerEntityId'] })
export class InsurancePolicy {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'policy_number', type: 'text' })
  policyNumber!: string

  @ManyToOne(() => InsuranceInsurer, { fieldName: 'insurer_id', deleteRule: 'restrict' })
  insurer!: InsuranceInsurer

  @ManyToOne(() => InsuranceInsurerContact, {
    fieldName: 'insurer_contact_id',
    nullable: true,
    deleteRule: 'set null',
  })
  insurerContact?: InsuranceInsurerContact | null

  /** CRM `customer_entities.id` (person or company); tag with `partner` / `customer` in CRM. */
  @Property({ name: 'referring_partner_entity_id', type: 'uuid' })
  referringPartnerEntityId!: string

  @Property({ name: 'catalog_product_id', type: 'uuid', nullable: true })
  catalogProductId?: string | null

  /** Optional link to `resources_resources.id` (scheduling / capacity); no ORM relation across modules. */
  @Property({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId?: string | null

  /** CRM `customer_entities.id` (kind person) — insured / policyholder person. */
  @Property({ name: 'insured_person_entity_id', type: 'uuid', nullable: true })
  insuredPersonEntityId?: string | null

  /** CRM `customer_entities.id` (kind company) — optional company for business use. */
  @Property({ name: 'insured_company_entity_id', type: 'uuid', nullable: true })
  insuredCompanyEntityId?: string | null

  /** Internal staff user (`users.id`) responsible for the policy (opiekun). */
  @Property({ name: 'caretaker_user_id', type: 'uuid', nullable: true })
  caretakerUserId?: string | null

  @Property({ name: 'valid_from', type: Date, nullable: true })
  validFrom?: Date | null

  @Property({ name: 'valid_to', type: Date, nullable: true })
  validTo?: Date | null

  @Property({ type: 'text', nullable: true })
  status?: string | null

  @Property({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

/** Inbound insurance inquiry / zapytanie (API-ingestible; attachments use entity id `insurance.lead`). */
@Entity({ tableName: 'insurance_leads' })
@Index({ name: 'insurance_leads_scope_idx', properties: ['organizationId', 'tenantId'] })
@Unique({
  name: 'insurance_leads_external_scope_unique',
  properties: ['organizationId', 'tenantId', 'externalId'],
})
export class InsuranceLead {
  [OptionalProps]?: 'createdAt' | 'updatedAt' | 'deletedAt'

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ type: 'text' })
  title!: string

  @Property({ type: 'text', default: 'received' })
  status: string = 'received'

  @Property({ type: 'text', nullable: true })
  source?: string | null

  /** Idempotent key for external systems (webhook / sync). */
  @Property({ name: 'external_id', type: 'text', nullable: true })
  externalId?: string | null

  /** Full structured payload from the channel (vehicle, contact, declared coverages, remote file refs, etc.). */
  @Property({ type: 'jsonb', nullable: true })
  payload?: Record<string, unknown> | null

  @Property({ name: 'referring_partner_entity_id', type: 'uuid', nullable: true })
  referringPartnerEntityId?: string | null

  @ManyToOne(() => InsurancePolicy, {
    fieldName: 'linked_policy_id',
    nullable: true,
    deleteRule: 'set null',
  })
  linkedPolicy?: InsurancePolicy | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
