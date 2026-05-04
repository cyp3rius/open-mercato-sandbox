import { Entity, Index, ManyToOne, PrimaryKey, Property, Unique } from '@mikro-orm/core'
import { CustomerEntity } from '@open-mercato/core/modules/customers/data/entities'

@Entity({ tableName: 'procurement_processes' })
@Index({ name: 'procurement_processes_scope_idx', properties: ['tenantId', 'organizationId'] })
@Index({ name: 'procurement_processes_customer_idx', properties: ['customerEntityId'] })
@Index({ name: 'procurement_processes_resource_idx', properties: ['resourceId'] })
export class ProcurementProcess {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ type: 'text' })
  title!: string

  @Property({ type: 'text', nullable: true })
  description?: string | null

  @Property({ name: 'started_at', type: Date, nullable: true })
  startedAt?: Date | null

  @Property({ name: 'status_value', type: 'text', nullable: true })
  statusValue?: string | null

  @Property({ name: 'status_label', type: 'text', nullable: true })
  statusLabel?: string | null

  @Property({ name: 'status_color', type: 'text', nullable: true })
  statusColor?: string | null

  @Property({ name: 'status_icon', type: 'text', nullable: true })
  statusIcon?: string | null

  @Property({ name: 'type_value', type: 'text', nullable: true })
  typeValue?: string | null

  @Property({ name: 'type_label', type: 'text', nullable: true })
  typeLabel?: string | null

  @Property({ name: 'type_color', type: 'text', nullable: true })
  typeColor?: string | null

  @Property({ name: 'type_icon', type: 'text', nullable: true })
  typeIcon?: string | null

  @Property({ name: 'customer_entity_id', type: 'uuid', nullable: true })
  customerEntityId?: string | null

  @Property({ name: 'sales_quote_id', type: 'uuid', nullable: true })
  salesQuoteId?: string | null

  @Property({ name: 'sales_invoice_id', type: 'uuid', nullable: true })
  salesInvoiceId?: string | null

  @Property({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId?: string | null

  @Property({ name: 'selected_supplier_id', type: 'uuid', nullable: true })
  selectedSupplierId?: string | null

  /** Spec line chosen for refinancing (must be linked to `selectedSupplierId`). */
  @Property({ name: 'refinancing_line_item_id', type: 'uuid', nullable: true })
  refinancingLineItemId?: string | null

  @Property({ name: 'refinancing_notes', type: 'text', nullable: true })
  refinancingNotes?: string | null

  @Property({ name: 'refinancing_enabled', type: 'boolean', default: false })
  refinancingEnabled: boolean = false

  @Property({ name: 'closed_at', type: Date, nullable: true })
  closedAt?: Date | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null

  /** Open Mercato user responsible for handling this process (see procurement.processes.handle). */
  @Property({ name: 'handler_user_id', type: 'uuid', nullable: true })
  handlerUserId?: string | null
}

@Entity({ tableName: 'procurement_process_suppliers' })
@Index({ name: 'procurement_process_suppliers_process_idx', properties: ['process'] })
@Index({ name: 'procurement_process_suppliers_scope_idx', properties: ['tenantId', 'organizationId'] })
@Index({
  name: 'procurement_process_suppliers_vendor_customer_entity_idx',
  properties: ['vendorCustomerEntity'],
})
export class ProcurementProcessSupplier {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @ManyToOne(() => ProcurementProcess, { fieldName: 'process_id' })
  process!: ProcurementProcess

  @ManyToOne(() => CustomerEntity, { fieldName: 'vendor_customer_entity_id', nullable: true })
  vendorCustomerEntity?: CustomerEntity | null

  @Property({ name: 'vendor_label', type: 'text' })
  vendorLabel!: string

  @Property({ name: 'contact_name', type: 'text', nullable: true })
  contactName?: string | null

  @Property({ type: 'text', nullable: true })
  email?: string | null

  @Property({ type: 'text', nullable: true })
  phone?: string | null

  @Property({ type: 'text', nullable: true })
  website?: string | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'offer_summary', type: 'text', nullable: true })
  offerSummary?: string | null

  @Property({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number = 0

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'procurement_process_line_items' })
@Index({ name: 'procurement_process_line_items_process_idx', properties: ['process'] })
@Index({ name: 'procurement_process_line_items_resource_idx', properties: ['resourceId'] })
export class ProcurementProcessLineItem {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @ManyToOne(() => ProcurementProcess, { fieldName: 'process_id' })
  process!: ProcurementProcess

  @Property({ type: 'text' })
  title!: string

  @Property({ type: 'text', nullable: true })
  specification?: string | null

  @Property({ type: 'float', nullable: true })
  quantity?: number | null

  @Property({ name: 'unit_label', type: 'text', nullable: true })
  unitLabel?: string | null

  @Property({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number = 0

  /** Optional outcome resource for this specification line (at most one per line). */
  @Property({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

/** M:N link: a supplier can cover many specification lines; the same line can be linked to many suppliers. */
@Entity({ tableName: 'procurement_process_supplier_line_items' })
@Unique({
  name: 'procurement_proc_supplier_line_uidx',
  properties: ['supplier', 'lineItem'],
})
@Index({ name: 'procurement_supplier_line_supplier_idx', properties: ['supplier'] })
@Index({ name: 'procurement_supplier_line_line_idx', properties: ['lineItem'] })
export class ProcurementProcessSupplierLineItem {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @ManyToOne(() => ProcurementProcessSupplier, { fieldName: 'supplier_id' })
  supplier!: ProcurementProcessSupplier

  @ManyToOne(() => ProcurementProcessLineItem, { fieldName: 'line_item_id' })
  lineItem!: ProcurementProcessLineItem

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()
}

@Entity({ tableName: 'operations_tasks' })
@Index({
  name: 'operations_tasks_context_idx',
  properties: ['tenantId', 'organizationId', 'contextType', 'contextId'],
})
@Index({ name: 'operations_tasks_assignee_idx', properties: ['assignedUserId'] })
export class OperationsTask {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'context_type', type: 'text' })
  contextType!: string

  @Property({ name: 'context_id', type: 'uuid' })
  contextId!: string

  @Property({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId?: string | null

  @Property({ type: 'text' })
  title!: string

  @Property({ type: 'text', nullable: true })
  body?: string | null

  @Property({ name: 'task_status', type: 'text', default: 'open' })
  taskStatus: string = 'open'

  @Property({ name: 'due_at', type: Date, nullable: true })
  dueAt?: Date | null

  @Property({ name: 'assigned_user_id', type: 'uuid', nullable: true })
  assignedUserId?: string | null

  @Property({ name: 'delegated_from_user_id', type: 'uuid', nullable: true })
  delegatedFromUserId?: string | null

  @Property({ name: 'source_action_value', type: 'text', nullable: true })
  sourceActionValue?: string | null

  @Property({ name: 'work_item_user_task_id', type: 'uuid', nullable: true })
  workItemUserTaskId?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'procurement_process_timeline_events' })
@Index({ name: 'procurement_timeline_process_idx', properties: ['process'] })
export class ProcurementProcessTimelineEvent {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @ManyToOne(() => ProcurementProcess, { fieldName: 'process_id' })
  process!: ProcurementProcess

  @Property({ name: 'event_type', type: 'text' })
  eventType!: string

  @Property({ type: 'text' })
  message!: string

  @Property({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId?: string | null

  @Property({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()
}

@Entity({ tableName: 'procurement_process_status_transitions' })
@Index({
  name: 'procurement_status_transitions_scope_from_to_uidx',
  properties: ['tenantId', 'organizationId', 'fromStatusValue', 'toStatusValue'],
  options: { unique: true },
})
@Index({ name: 'procurement_status_transitions_scope_idx', properties: ['tenantId', 'organizationId'] })
export class ProcurementProcessStatusTransition {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  /** Normalized status value before transition (matches dictionary `normalizedValue`). */
  @Property({ name: 'from_status_value', type: 'text' })
  fromStatusValue!: string

  /** Normalized status value after transition. */
  @Property({ name: 'to_status_value', type: 'text' })
  toStatusValue!: string

  /** Optional workflow `workflowId` to start after a successful transition (automation only). */
  @Property({ name: 'automation_workflow_id', type: 'text', nullable: true })
  automationWorkflowId?: string | null

  @Property({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number = 0

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'procurement_organization_settings' })
@Unique({
  name: 'procurement_org_settings_scope_uidx',
  properties: ['tenantId', 'organizationId'],
})
@Index({ name: 'procurement_org_settings_scope_idx', properties: ['tenantId', 'organizationId'] })
export class ProcurementOrganizationSettings {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  /** Canonical dictionary value for new processes when `statusValue` is not sent. */
  @Property({ name: 'default_process_status_value', type: 'text', nullable: true })
  defaultProcessStatusValue?: string | null

  /**
   * Canonical dictionary value treated as the completed / terminal procurement status for this org (optional).
   */
  @Property({ name: 'terminal_process_status_value', type: 'text', nullable: true })
  terminalProcessStatusValue?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}
