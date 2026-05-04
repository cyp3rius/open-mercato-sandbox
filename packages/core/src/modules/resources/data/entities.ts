import { Entity, PrimaryKey, Property, Index, OneToMany, ManyToOne, Collection, Unique } from '@mikro-orm/core'

@Entity({ tableName: 'resources_resource_types' })
@Index({ name: 'resources_resource_types_tenant_org_idx', properties: ['tenantId', 'organizationId'] })
export class ResourcesResourceType {
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

  @Property({ name: 'appearance_icon', type: 'text', nullable: true })
  appearanceIcon?: string | null

  @Property({ name: 'appearance_color', type: 'text', nullable: true })
  appearanceColor?: string | null

  /** When true, resources of this type may store a financing profile (e.g. internal fleet vehicles). */
  @Property({ name: 'vehicle_financing_eligible', type: 'boolean', default: false })
  vehicleFinancingEligible: boolean = false

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'resources_resources' })
@Index({ name: 'resources_resources_tenant_org_idx', properties: ['tenantId', 'organizationId'] })
export class ResourcesResource {
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

  @Property({ name: 'resource_type_id', type: 'uuid', nullable: true })
  resourceTypeId?: string | null

  @Property({ type: 'int', nullable: true })
  capacity?: number | null

  @Property({ name: 'capacity_unit_value', type: 'text', nullable: true })
  capacityUnitValue?: string | null

  @Property({ name: 'capacity_unit_name', type: 'text', nullable: true })
  capacityUnitName?: string | null

  @Property({ name: 'capacity_unit_color', type: 'text', nullable: true })
  capacityUnitColor?: string | null

  @Property({ name: 'capacity_unit_icon', type: 'text', nullable: true })
  capacityUnitIcon?: string | null

  @Property({ name: 'appearance_icon', type: 'text', nullable: true })
  appearanceIcon?: string | null

  @Property({ name: 'appearance_color', type: 'text', nullable: true })
  appearanceColor?: string | null

  @Property({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true

  @Property({ name: 'availability_rule_set_id', type: 'uuid', nullable: true })
  availabilityRuleSetId?: string | null

  @Property({ name: 'customer_entity_id', type: 'uuid', nullable: true })
  customerEntityId?: string | null

  @Property({ name: 'procurement_process_id', type: 'uuid', nullable: true })
  procurementProcessId?: string | null

  /** Primary insurance policy for this resource (no ORM link to insurance module). */
  @Property({ name: 'insurance_policy_id', type: 'uuid', nullable: true })
  insurancePolicyId?: string | null

  @Property({ name: 'status_value', type: 'text', nullable: true })
  statusValue?: string | null

  @Property({ name: 'status_label', type: 'text', nullable: true })
  statusLabel?: string | null

  @Property({ name: 'status_color', type: 'text', nullable: true })
  statusColor?: string | null

  @Property({ name: 'status_icon', type: 'text', nullable: true })
  statusIcon?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'resources_resource_accessory_links' })
@Index({ name: 'resources_resource_accessory_links_scope_idx', properties: ['organizationId', 'tenantId'] })
@Index({ name: 'resources_resource_accessory_links_host_idx', properties: ['hostResource'] })
@Unique({
  name: 'resources_resource_accessory_links_host_accessory_unique',
  properties: ['hostResource', 'accessoryResource'],
})
export class ResourcesResourceAccessoryLink {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @ManyToOne(() => ResourcesResource, { fieldName: 'host_resource_id' })
  hostResource!: ResourcesResource

  @ManyToOne(() => ResourcesResource, { fieldName: 'accessory_resource_id' })
  accessoryResource!: ResourcesResource

  @Property({ name: 'is_mounted', type: 'boolean', default: false })
  isMounted: boolean = false

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'resources_resource_comments' })
@Index({ name: 'resources_resource_comments_resource_idx', properties: ['resource'] })
@Index({ name: 'resources_resource_comments_tenant_org_idx', properties: ['tenantId', 'organizationId'] })
export class ResourcesResourceComment {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'body', type: 'text' })
  body!: string

  @Property({ name: 'author_user_id', type: 'uuid', nullable: true })
  authorUserId?: string | null

  @Property({ name: 'appearance_icon', type: 'text', nullable: true })
  appearanceIcon?: string | null

  @Property({ name: 'appearance_color', type: 'text', nullable: true })
  appearanceColor?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null

  @ManyToOne(() => ResourcesResource, { fieldName: 'resource_id' })
  resource!: ResourcesResource
}

@Entity({ tableName: 'resources_resource_activities' })
@Index({ name: 'resources_resource_activities_resource_idx', properties: ['resource'] })
@Index({ name: 'resources_resource_activities_tenant_org_idx', properties: ['tenantId', 'organizationId'] })
@Index({ name: 'resources_resource_activities_resource_occurred_created_idx', properties: ['resource', 'occurredAt', 'createdAt'] })
export class ResourcesResourceActivity {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'activity_type', type: 'text' })
  activityType!: string

  @Property({ name: 'subject', type: 'text', nullable: true })
  subject?: string | null

  @Property({ name: 'body', type: 'text', nullable: true })
  body?: string | null

  @Property({ name: 'occurred_at', type: Date, nullable: true })
  occurredAt?: Date | null

  @Property({ name: 'author_user_id', type: 'uuid', nullable: true })
  authorUserId?: string | null

  @Property({ name: 'appearance_icon', type: 'text', nullable: true })
  appearanceIcon?: string | null

  @Property({ name: 'appearance_color', type: 'text', nullable: true })
  appearanceColor?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @ManyToOne(() => ResourcesResource, { fieldName: 'resource_id' })
  resource!: ResourcesResource
}

@Entity({ tableName: 'resources_resource_service_book_entries' })
@Index({ name: 'resources_resource_service_book_entries_resource_idx', properties: ['resource'] })
@Index({ name: 'resources_resource_service_book_entries_tenant_org_idx', properties: ['tenantId', 'organizationId'] })
@Index({
  name: 'resources_resource_service_book_entries_resource_in_created_idx',
  properties: ['resource', 'serviceInAt', 'createdAt'],
})
export class ResourcesResourceServiceBookEntry {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'service_type', type: 'text' })
  serviceType!: string

  @Property({ name: 'service_activity', type: 'text' })
  serviceActivity!: string

  @Property({ name: 'service_in_at', type: Date })
  serviceInAt!: Date

  @Property({ name: 'service_out_at', type: Date, nullable: true })
  serviceOutAt?: Date | null

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @ManyToOne(() => ResourcesResource, { fieldName: 'resource_id' })
  resource!: ResourcesResource
}

@Entity({ tableName: 'resources_resource_tags' })
@Index({ name: 'resources_resource_tags_scope_idx', properties: ['organizationId', 'tenantId'] })
@Unique({ name: 'resources_resource_tags_slug_unique', properties: ['organizationId', 'tenantId', 'slug'] })
export class ResourcesResourceTag {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ type: 'text' })
  slug!: string

  @Property({ type: 'text' })
  label!: string

  @Property({ type: 'text', nullable: true })
  color?: string | null

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @OneToMany(() => ResourcesResourceTagAssignment, (assignment) => assignment.tag)
  assignments = new Collection<ResourcesResourceTagAssignment>(this)
}

@Entity({ tableName: 'resources_resource_tag_assignments' })
@Index({ name: 'resources_resource_tag_assignments_scope_idx', properties: ['organizationId', 'tenantId'] })
@Unique({
  name: 'resources_resource_tag_assignments_unique',
  properties: ['tag', 'resource'],
})
export class ResourcesResourceTagAssignment {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @ManyToOne(() => ResourcesResourceTag, { fieldName: 'tag_id' })
  tag!: ResourcesResourceTag

  @ManyToOne(() => ResourcesResource, { fieldName: 'resource_id' })
  resource!: ResourcesResource

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'resources_resource_financing_profiles' })
@Index({ name: 'resources_resource_financing_profiles_scope_idx', properties: ['tenantId', 'organizationId'] })
@Index({ name: 'resources_resource_financing_profiles_resource_idx', properties: ['resource'] })
export class ResourcesResourceFinancingProfile {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @ManyToOne(() => ResourcesResource, { fieldName: 'resource_id' })
  resource!: ResourcesResource

  @Property({ name: 'financing_kind', type: 'text' })
  financingKind!: string

  @Property({ name: 'term_months', type: 'int', nullable: true })
  termMonths?: number | null

  @Property({ name: 'vehicle_value_amount', type: 'float', nullable: true })
  vehicleValueAmount?: number | null

  @Property({ name: 'installment_amount', type: 'float', nullable: true })
  installmentAmount?: number | null

  @Property({ name: 'currency_code', type: 'text', nullable: true })
  currencyCode?: string | null

  @Property({ name: 'valid_from', type: Date, nullable: true })
  validFrom?: Date | null

  @Property({ name: 'valid_to', type: Date, nullable: true })
  validTo?: Date | null

  @Property({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'resources_resource_gallery_items' })
@Index({ name: 'resources_resource_gallery_items_resource_idx', properties: ['resource'] })
@Index({ name: 'resources_resource_gallery_items_scope_idx', properties: ['tenantId', 'organizationId'] })
export class ResourcesResourceGalleryItem {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @ManyToOne(() => ResourcesResource, { fieldName: 'resource_id' })
  resource!: ResourcesResource

  @Property({ name: 'attachment_id', type: 'uuid' })
  attachmentId!: string

  @Property({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number = 0

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
