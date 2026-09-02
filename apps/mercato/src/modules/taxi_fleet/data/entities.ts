import { Entity, Index, PrimaryKey, Property, Unique } from '@mikro-orm/core'

@Entity({ tableName: 'taxi_fleet_organization_settings' })
@Unique({ properties: ['tenantId', 'organizationId'] })
@Index({ name: 'taxi_fleet_organization_settings_scope_idx', properties: ['tenantId', 'organizationId'] })
export class TaxiFleetOrganizationSettings {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'resource_type_id', type: 'uuid', nullable: true })
  resourceTypeId?: string | null

  @Property({ name: 'default_payout_percent', type: 'numeric', precision: 5, scale: 2, default: 0 })
  defaultPayoutPercent: string = '0'

  @Property({ name: 'settings_json', type: 'json', nullable: true })
  settingsJson?: Record<string, unknown> | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()
}

@Entity({ tableName: 'taxi_fleet_driver_profiles' })
@Unique({ properties: ['tenantId', 'organizationId', 'teamMemberId'] })
@Index({ name: 'taxi_fleet_driver_profiles_scope_idx', properties: ['tenantId', 'organizationId'] })
export class TaxiFleetDriverProfile {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'team_member_id', type: 'uuid' })
  teamMemberId!: string

  @Property({ name: 'payout_percent', type: 'numeric', precision: 5, scale: 2, default: 0 })
  payoutPercent: string = '0'

  @Property({ name: 'default_resource_id', type: 'uuid', nullable: true })
  defaultResourceId?: string | null

  @Property({ name: 'external_app_enabled', type: 'boolean', default: false })
  externalAppEnabled: boolean = false

  @Property({ name: 'bolt_driver_id', type: 'text', nullable: true })
  boltDriverId?: string | null

  @Property({ name: 'uber_driver_id', type: 'text', nullable: true })
  uberDriverId?: string | null

  @Property({ name: 'free_driver_id', type: 'text', nullable: true })
  freeDriverId?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'taxi_fleet_daily_assignments' })
@Unique({ properties: ['tenantId', 'organizationId', 'teamMemberId', 'assignmentDate'] })
@Unique({ properties: ['tenantId', 'organizationId', 'resourceId', 'assignmentDate'] })
@Index({ name: 'taxi_fleet_daily_assignments_scope_idx', properties: ['tenantId', 'organizationId'] })
@Index({ name: 'taxi_fleet_daily_assignments_date_idx', properties: ['assignmentDate', 'tenantId'] })
export class TaxiFleetDailyAssignment {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'team_member_id', type: 'uuid' })
  teamMemberId!: string

  @Property({ name: 'resource_id', type: 'uuid' })
  resourceId!: string

  @Property({ name: 'assignment_date', type: 'date' })
  assignmentDate!: string

  @Property({ name: 'shift_start', type: Date, nullable: true })
  shiftStart?: Date | null

  @Property({ name: 'shift_end', type: Date, nullable: true })
  shiftEnd?: Date | null

  @Property({ type: 'text', default: 'planned' })
  status: 'planned' | 'confirmed' | 'completed' | 'cancelled' = 'planned'

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'taxi_fleet_trips' })
@Index({ name: 'taxi_fleet_trips_scope_idx', properties: ['tenantId', 'organizationId'] })
@Index({ name: 'taxi_fleet_trips_member_idx', properties: ['teamMemberId', 'tenantId'] })
@Index({ name: 'taxi_fleet_trips_status_idx', properties: ['status', 'tenantId'] })
export class TaxiFleetTrip {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'team_member_id', type: 'uuid', nullable: true })
  teamMemberId?: string | null

  @Property({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId?: string | null

  @Property({ name: 'assignment_id', type: 'uuid', nullable: true })
  assignmentId?: string | null

  @Property({ name: 'trip_type', type: 'text' })
  tripType!: 'client' | 'private' | 'internal' | 'empty' | 'event' | 'other' | 'platform'

  @Property({ type: 'text', nullable: true })
  platform?: 'uber' | 'bolt' | 'free' | null

  @Property({ name: 'external_trip_id', type: 'text', nullable: true })
  externalTripId?: string | null

  @Property({ name: 'started_at', type: Date, nullable: true })
  startedAt?: Date | null

  @Property({ name: 'ended_at', type: Date, nullable: true })
  endedAt?: Date | null

  @Property({ name: 'odometer_start', type: 'numeric', precision: 12, scale: 2, nullable: true })
  odometerStart?: string | null

  @Property({ name: 'odometer_end', type: 'numeric', precision: 12, scale: 2, nullable: true })
  odometerEnd?: string | null

  @Property({ name: 'distance_km', type: 'numeric', precision: 12, scale: 2, nullable: true })
  distanceKm?: string | null

  @Property({ name: 'revenue_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  revenueAmount?: string | null

  @Property({ name: 'currency_code', type: 'text', default: 'PLN' })
  currencyCode: string = 'PLN'

  @Property({ name: 'customer_person_id', type: 'uuid', nullable: true })
  customerPersonId?: string | null

  @Property({ name: 'customer_company_id', type: 'uuid', nullable: true })
  customerCompanyId?: string | null

  @Property({ type: 'text', default: 'new' })
  status: string = 'new'

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ type: 'json', nullable: true })
  metadata?: Record<string, unknown> | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'taxi_fleet_trip_cost_lines' })
@Index({ name: 'taxi_fleet_trip_cost_lines_trip_idx', properties: ['tripId'] })
export class TaxiFleetTripCostLine {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'trip_id', type: 'uuid' })
  tripId!: string

  @Property({ name: 'cost_type', type: 'text' })
  costType!: 'fuel' | 'toll' | 'parking' | 'maintenance' | 'other'

  @Property({ type: 'numeric', precision: 14, scale: 2 })
  amount!: string

  @Property({ name: 'currency_code', type: 'text', default: 'PLN' })
  currencyCode: string = 'PLN'

  @Property({ type: 'numeric', precision: 12, scale: 3, nullable: true })
  quantity?: string | null

  @Property({ name: 'unit_price', type: 'numeric', precision: 14, scale: 2, nullable: true })
  unitPrice?: string | null

  @Property({ name: 'receipt_attachment_id', type: 'uuid', nullable: true })
  receiptAttachmentId?: string | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'taxi_fleet_financial_entries' })
@Index({ name: 'taxi_fleet_financial_entries_scope_idx', properties: ['tenantId', 'organizationId'] })
@Index({ name: 'taxi_fleet_financial_entries_member_idx', properties: ['teamMemberId', 'tenantId'] })
@Index({ name: 'taxi_fleet_financial_entries_occurred_idx', properties: ['occurredAt', 'tenantId'] })
export class TaxiFleetFinancialEntry {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'team_member_id', type: 'uuid' })
  teamMemberId!: string

  @Property({ type: 'text' })
  kind!: 'income' | 'expense'

  @Property({ name: 'income_document_type', type: 'text', nullable: true })
  incomeDocumentType?: 'receipt' | 'invoice' | null

  @Property({ name: 'cost_type', type: 'text', nullable: true })
  costType?: 'fuel' | 'toll' | 'parking' | 'maintenance' | 'other' | null

  @Property({ name: 'trip_id', type: 'uuid', nullable: true })
  tripId?: string | null

  @Property({ name: 'customer_person_id', type: 'uuid', nullable: true })
  customerPersonId?: string | null

  @Property({ name: 'customer_company_id', type: 'uuid', nullable: true })
  customerCompanyId?: string | null

  @Property({ type: 'numeric', precision: 14, scale: 2 })
  amount!: string

  @Property({ name: 'vat_rate_percent', type: 'numeric', precision: 5, scale: 2, default: 23 })
  vatRatePercent: string = '23'

  @Property({ name: 'currency_code', type: 'text', default: 'PLN' })
  currencyCode: string = 'PLN'

  @Property({ name: 'document_number', type: 'text', nullable: true })
  documentNumber?: string | null

  /** Seller/document NIP used for duplicate detection (from OCR when available). */
  @Property({ name: 'document_nip', type: 'text', nullable: true })
  documentNip?: string | null

  @Property({ name: 'is_document_duplicate', type: 'boolean', default: false })
  isDocumentDuplicate: boolean = false

  @Property({ name: 'duplicate_of_entry_id', type: 'uuid', nullable: true })
  duplicateOfEntryId?: string | null

  @Property({ name: 'occurred_at', type: Date })
  occurredAt!: Date

  @Property({ name: 'receipt_attachment_id', type: 'uuid', nullable: true })
  receiptAttachmentId?: string | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'taxi_fleet_weekly_settlements' })
@Unique({ properties: ['tenantId', 'organizationId', 'teamMemberId', 'weekStart'] })
@Index({ name: 'taxi_fleet_weekly_settlements_scope_idx', properties: ['tenantId', 'organizationId'] })
export class TaxiFleetWeeklySettlement {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'team_member_id', type: 'uuid' })
  teamMemberId!: string

  @Property({ name: 'week_start', type: 'date' })
  weekStart!: string

  @Property({ name: 'total_revenue', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalRevenue: string = '0'

  @Property({ name: 'total_costs', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalCosts: string = '0'

  @Property({ name: 'revenue_gross', type: 'numeric', precision: 14, scale: 2, default: 0 })
  revenueGross: string = '0'

  @Property({ name: 'revenue_net', type: 'numeric', precision: 14, scale: 2, default: 0 })
  revenueNet: string = '0'

  @Property({ name: 'costs_gross', type: 'numeric', precision: 14, scale: 2, default: 0 })
  costsGross: string = '0'

  @Property({ name: 'costs_net', type: 'numeric', precision: 14, scale: 2, default: 0 })
  costsNet: string = '0'

  @Property({ name: 'net_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  netAmount: string = '0'

  @Property({ name: 'payout_percent', type: 'numeric', precision: 5, scale: 2, default: 0 })
  payoutPercent: string = '0'

  @Property({ name: 'payout_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  payoutAmount: string = '0'

  @Property({ name: 'computed_distance_km', type: 'numeric', precision: 12, scale: 2, default: 0 })
  computedDistanceKm: string = '0'

  @Property({ name: 'total_distance_km', type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalDistanceKm: string = '0'

  @Property({ name: 'cash_expected', type: 'numeric', precision: 14, scale: 2, default: 0 })
  cashExpected: string = '0'

  @Property({ name: 'cash_collected', type: 'numeric', precision: 14, scale: 2, default: 0 })
  cashCollected: string = '0'

  @Property({ name: 'bonus_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  bonusAmount: string = '0'

  @Property({ name: 'compensation_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  compensationAmount: string = '0'

  @Property({ name: 'airport_a4_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  airportA4Amount: string = '0'

  @Property({ name: 'transfer_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  transferAmount: string = '0'

  @Property({ type: 'text', default: 'draft' })
  status: 'draft' | 'submitted' | 'approved' | 'paid' = 'draft'

  @Property({ name: 'submitted_at', type: Date, nullable: true })
  submittedAt?: Date | null

  @Property({ name: 'approved_by_user_id', type: 'uuid', nullable: true })
  approvedByUserId?: string | null

  @Property({ name: 'approved_at', type: Date, nullable: true })
  approvedAt?: Date | null

  @Property({ name: 'closure_type', type: 'text', nullable: true })
  closureType?: 'payout' | 'cash_return' | null

  @Property({ name: 'closure_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  closureAmount?: string | null

  @Property({ name: 'closed_at', type: Date, nullable: true })
  closedAt?: Date | null

  @Property({ name: 'snapshot_json', type: 'json', nullable: true })
  snapshotJson?: Record<string, unknown> | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'taxi_fleet_monthly_settlements' })
@Unique({ properties: ['tenantId', 'organizationId', 'monthStart'] })
@Index({ name: 'taxi_fleet_monthly_settlements_scope_idx', properties: ['tenantId', 'organizationId'] })
export class TaxiFleetMonthlySettlement {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'month_start', type: 'date' })
  monthStart!: string

  @Property({ name: 'revenue_gross', type: 'numeric', precision: 14, scale: 2, default: 0 })
  revenueGross: string = '0'

  @Property({ name: 'revenue_net', type: 'numeric', precision: 14, scale: 2, default: 0 })
  revenueNet: string = '0'

  @Property({ name: 'costs_gross', type: 'numeric', precision: 14, scale: 2, default: 0 })
  costsGross: string = '0'

  @Property({ name: 'costs_net', type: 'numeric', precision: 14, scale: 2, default: 0 })
  costsNet: string = '0'

  @Property({ name: 'net_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  netAmount: string = '0'

  @Property({ name: 'payout_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  payoutAmount: string = '0'

  @Property({ name: 'total_distance_km', type: 'numeric', precision: 12, scale: 2, default: 0 })
  totalDistanceKm: string = '0'

  @Property({ name: 'cash_expected', type: 'numeric', precision: 14, scale: 2, default: 0 })
  cashExpected: string = '0'

  @Property({ name: 'cash_collected', type: 'numeric', precision: 14, scale: 2, default: 0 })
  cashCollected: string = '0'

  @Property({ name: 'bonus_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  bonusAmount: string = '0'

  @Property({ name: 'compensation_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  compensationAmount: string = '0'

  @Property({ name: 'airport_a4_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  airportA4Amount: string = '0'

  @Property({ name: 'transfer_amount', type: 'numeric', precision: 14, scale: 2, default: 0 })
  transferAmount: string = '0'

  @Property({ name: 'weekly_count', type: 'integer', default: 0 })
  weeklyCount: number = 0

  @Property({ name: 'driver_count', type: 'integer', default: 0 })
  driverCount: number = 0

  @Property({ type: 'text', default: 'draft' })
  status: 'draft' | 'approved' | 'closed' = 'draft'

  @Property({ name: 'approved_by_user_id', type: 'uuid', nullable: true })
  approvedByUserId?: string | null

  @Property({ name: 'approved_at', type: Date, nullable: true })
  approvedAt?: Date | null

  @Property({ type: 'text', nullable: true })
  notes?: string | null

  @Property({ name: 'snapshot_json', type: 'json', nullable: true })
  snapshotJson?: Record<string, unknown> | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'taxi_fleet_location_pings' })
@Index({ name: 'taxi_fleet_location_pings_member_recorded_idx', properties: ['teamMemberId', 'recordedAt'] })
@Index({ name: 'taxi_fleet_location_pings_assignment_recorded_idx', properties: ['assignmentId', 'recordedAt'] })
@Index({ name: 'taxi_fleet_location_pings_scope_idx', properties: ['tenantId', 'organizationId'] })
export class TaxiFleetLocationPing {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'team_member_id', type: 'uuid' })
  teamMemberId!: string

  @Property({ name: 'assignment_id', type: 'uuid', nullable: true })
  assignmentId?: string | null

  @Property({ name: 'trip_id', type: 'uuid', nullable: true })
  tripId?: string | null

  @Property({ name: 'recorded_at', type: Date })
  recordedAt!: Date

  @Property({ type: 'float' })
  lat!: number

  @Property({ type: 'float' })
  lon!: number

  @Property({ name: 'accuracy_m', type: 'float', nullable: true })
  accuracyM?: number | null

  @Property({ name: 'speed_mps', type: 'float', nullable: true })
  speedMps?: number | null

  @Property({ type: 'float', nullable: true })
  heading?: number | null

  @Property({ type: 'text', default: 'browser' })
  source: string = 'browser'

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()
}

@Entity({ tableName: 'taxi_fleet_receipt_extractions' })
@Index({ name: 'taxi_fleet_receipt_extractions_scope_idx', properties: ['tenantId', 'organizationId'] })
@Index({ name: 'taxi_fleet_receipt_extractions_attachment_idx', properties: ['attachmentId'] })
@Index({ name: 'taxi_fleet_receipt_extractions_trip_idx', properties: ['tripId'] })
@Index({ name: 'taxi_fleet_receipt_extractions_entry_idx', properties: ['financialEntryId'] })
@Index({ name: 'taxi_fleet_receipt_extractions_status_idx', properties: ['status', 'tenantId'] })
export class TaxiFleetReceiptExtraction {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ name: 'attachment_id', type: 'uuid' })
  attachmentId!: string

  @Property({ name: 'trip_id', type: 'uuid', nullable: true })
  tripId?: string | null

  @Property({ name: 'financial_entry_id', type: 'uuid', nullable: true })
  financialEntryId?: string | null

  @Property({ type: 'text', default: 'pending' })
  status: 'pending' | 'processing' | 'extracted' | 'needs_review' | 'failed' | 'applied' = 'pending'

  @Property({ name: 'driver_document_number', type: 'text', nullable: true })
  driverDocumentNumber?: string | null

  @Property({ name: 'driver_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  driverAmount?: string | null

  @Property({ name: 'ocr_document_number', type: 'text', nullable: true })
  ocrDocumentNumber?: string | null

  @Property({ name: 'ocr_gross_amount', type: 'numeric', precision: 14, scale: 2, nullable: true })
  ocrGrossAmount?: string | null

  @Property({ name: 'ocr_distance_km', type: 'numeric', precision: 12, scale: 2, nullable: true })
  ocrDistanceKm?: string | null

  @Property({ name: 'ocr_vat_rate_percent', type: 'numeric', precision: 5, scale: 2, nullable: true })
  ocrVatRatePercent?: string | null

  @Property({ name: 'ocr_buyer_nip', type: 'text', nullable: true })
  ocrBuyerNip?: string | null

  @Property({ name: 'ocr_seller_nip', type: 'text', nullable: true })
  ocrSellerNip?: string | null

  @Property({ name: 'ocr_occurred_at', type: Date, nullable: true })
  ocrOccurredAt?: Date | null

  @Property({ type: 'numeric', precision: 4, scale: 3, nullable: true })
  confidence?: string | null

  @Property({ name: 'raw_text_excerpt', type: 'text', nullable: true })
  rawTextExcerpt?: string | null

  @Property({ type: 'text', nullable: true })
  model?: string | null

  @Property({ name: 'warnings_json', type: 'json', nullable: true })
  warningsJson?: Record<string, unknown>[] | null

  @Property({ name: 'resolved_company_id', type: 'uuid', nullable: true })
  resolvedCompanyId?: string | null

  @Property({ name: 'applied_document_number', type: 'text', nullable: true })
  appliedDocumentNumber?: string | null

  @Property({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null

  @Property({ name: 'processed_at', type: Date, nullable: true })
  processedAt?: Date | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}

@Entity({ tableName: 'taxi_fleet_platform_sync_runs' })
@Index({ name: 'taxi_fleet_platform_sync_runs_scope_idx', properties: ['tenantId', 'organizationId', 'startedAt'] })
export class TaxiFleetPlatformSyncRun {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @Property({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string

  @Property({ name: 'organization_id', type: 'uuid' })
  organizationId!: string

  @Property({ type: 'text' })
  platform!: 'uber' | 'bolt' | 'free' | 'all'

  @Property({ type: 'text' })
  trigger!: 'schedule' | 'manual' | 'csv'

  @Property({ type: 'text', default: 'running' })
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'partial' = 'running'

  @Property({ name: 'started_at', type: Date })
  startedAt!: Date

  @Property({ name: 'finished_at', type: Date, nullable: true })
  finishedAt?: Date | null

  @Property({ name: 'fetched_count', type: 'int', default: 0 })
  fetchedCount: number = 0

  @Property({ name: 'upserted_count', type: 'int', default: 0 })
  upsertedCount: number = 0

  @Property({ name: 'skipped_count', type: 'int', default: 0 })
  skippedCount: number = 0

  @Property({ name: 'error_count', type: 'int', default: 0 })
  errorCount: number = 0

  @Property({ name: 'window_from', type: Date, nullable: true })
  windowFrom?: Date | null

  @Property({ name: 'window_to', type: Date, nullable: true })
  windowTo?: Date | null

  @Property({ name: 'error_summary', type: 'json', nullable: true })
  errorSummary?: Record<string, unknown> | null

  @Property({ name: 'job_payload', type: 'json', nullable: true })
  jobPayload?: Record<string, unknown> | null

  @Property({ name: 'created_at', type: Date, onCreate: () => new Date() })
  createdAt: Date = new Date()

  @Property({ name: 'updated_at', type: Date, onUpdate: () => new Date() })
  updatedAt: Date = new Date()

  @Property({ name: 'deleted_at', type: Date, nullable: true })
  deletedAt?: Date | null
}
