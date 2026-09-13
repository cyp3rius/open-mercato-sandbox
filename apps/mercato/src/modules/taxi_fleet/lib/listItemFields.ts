function readString(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (value == null) return null
  return String(value)
}

function readIso(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString()
  if (typeof value === 'string' && value.trim().length) return value
  return null
}

function pickString(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = readString(record[key])
    if (value != null && value.trim().length) return value
  }
  return null
}

function readPaymentTypeFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null
  const root = metadata as Record<string, unknown>
  const nested =
    root.tripRequest && typeof root.tripRequest === 'object' && !Array.isArray(root.tripRequest)
      ? (root.tripRequest as Record<string, unknown>)
      : null
  const value = nested?.paymentType ?? root.paymentType
  return typeof value === 'string' && value.trim().length ? value.trim() : null
}

export function transformTripListItem(item: Record<string, unknown> | null | undefined) {
  const record = (item ?? {}) as Record<string, unknown>
  const metadata = record.metadata ?? null
  const paymentType =
    pickString(record, 'paymentType', 'payment_type') ?? readPaymentTypeFromMetadata(metadata)
  return {
    ...record,
    id: pickString(record, 'id') ?? '',
    organizationId: pickString(record, 'organizationId', 'organization_id'),
    tenantId: pickString(record, 'tenantId', 'tenant_id'),
    teamMemberId: pickString(record, 'teamMemberId', 'team_member_id'),
    resourceId: pickString(record, 'resourceId', 'resource_id'),
    assignmentId: pickString(record, 'assignmentId', 'assignment_id'),
    tripType: pickString(record, 'tripType', 'trip_type') ?? 'client',
    platform: pickString(record, 'platform'),
    externalTripId: pickString(record, 'externalTripId', 'external_trip_id'),
    startedAt: readIso(record.startedAt ?? record.started_at),
    endedAt: readIso(record.endedAt ?? record.ended_at),
    distanceKm: record.distanceKm ?? record.distance_km ?? null,
    revenueAmount: pickString(record, 'revenueAmount', 'revenue_amount'),
    currencyCode: pickString(record, 'currencyCode', 'currency_code'),
    customerPersonId: pickString(record, 'customerPersonId', 'customer_person_id'),
    customerCompanyId: pickString(record, 'customerCompanyId', 'customer_company_id'),
    paymentType,
    status: pickString(record, 'status') ?? 'new',
    notes: pickString(record, 'notes'),
    metadata,
    receiptAttachmentId: pickString(record, 'receiptAttachmentId', 'receipt_attachment_id'),
    ocrStatus: pickString(record, 'ocrStatus', 'ocr_status'),
    warnings: Array.isArray(record.warnings)
      ? record.warnings
      : Array.isArray(record.receiptWarnings)
        ? record.receiptWarnings
        : [],
    createdAt: readIso(record.createdAt ?? record.created_at),
    updatedAt: readIso(record.updatedAt ?? record.updated_at),
  }
}

export function transformAssignmentListItem(item: Record<string, unknown> | null | undefined) {
  const record = (item ?? {}) as Record<string, unknown>
  return {
    ...record,
    id: pickString(record, 'id') ?? '',
    organizationId: pickString(record, 'organizationId', 'organization_id'),
    tenantId: pickString(record, 'tenantId', 'tenant_id'),
    teamMemberId: pickString(record, 'teamMemberId', 'team_member_id') ?? '',
    resourceId: pickString(record, 'resourceId', 'resource_id') ?? '',
    assignmentDate: pickString(record, 'assignmentDate', 'assignment_date') ?? '',
    plannedShiftStart: readIso(record.plannedShiftStart ?? record.planned_shift_start),
    plannedShiftEnd: readIso(record.plannedShiftEnd ?? record.planned_shift_end),
    shiftStart: readIso(record.shiftStart ?? record.shift_start),
    shiftEnd: readIso(record.shiftEnd ?? record.shift_end),
    gpsDistanceKm: pickString(record, 'gpsDistanceKm', 'gps_distance_km'),
    status: pickString(record, 'status') ?? 'planned',
    notes: pickString(record, 'notes'),
    createdAt: readIso(record.createdAt ?? record.created_at),
    updatedAt: readIso(record.updatedAt ?? record.updated_at),
  }
}
