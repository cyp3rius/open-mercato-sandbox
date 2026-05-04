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
