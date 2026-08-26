import { defaultTripRequestDetails, buildTripRequestMetadata } from '../tripRequestForm'
import type { DriverPlace } from './tripTypes'
import type { DriverCommercialValue } from '../../components/driverApp/DriverCommercialStep'
import { parseNumericValue } from '@open-mercato/shared/lib/numeric'

export function buildDriverTripPayload(input: {
  route: {
    from: DriverPlace
    to: DriverPlace
    waypoints: DriverPlace[]
    startedAt: string
    endedAt: string
    distanceKm: number | null
    durationText?: string | null
  }
  commercial: DriverCommercialValue
  resourceId?: string | null
  assignmentId?: string | null
  status?: 'completed' | 'in_progress'
  serverTripId?: string | null
}) {
  const details = defaultTripRequestDetails()
  details.fromAddress = input.route.from.address.trim()
  details.toAddress = input.route.to.address.trim()
  details.waypointAddresses = input.route.waypoints
    .map((wp) => wp.address.trim())
    .filter(Boolean)
    .join('\n')
  details.distanceKm =
    input.route.distanceKm != null && Number.isFinite(input.route.distanceKm)
      ? String(input.route.distanceKm)
      : ''
  details.durationText = input.route.durationText?.trim() || ''

  const metadata = buildTripRequestMetadata(details)
  if (input.route.distanceKm != null && Number.isFinite(input.route.distanceKm) && input.route.distanceKm > 0) {
    metadata.distanceSource = 'route'
    metadata.routeDistanceKm = input.route.distanceKm.toFixed(2)
  }
  const revenue = parseNumericValue(input.commercial.revenueAmount) ?? 0
  const documentNumber = input.commercial.receiptDocumentNumber.trim()

  const isReceiptCompletion = input.commercial.completionMode === 'receipt'

  const base: Record<string, unknown> = {
    completionMode: input.commercial.completionMode,
    tripType: isReceiptCompletion ? 'other' : input.commercial.tripType,
    platform: isReceiptCompletion ? null : input.commercial.platform,
    startedAt: input.route.startedAt,
    endedAt: input.route.endedAt || null,
    distanceKm: input.route.distanceKm,
    revenueAmount: isReceiptCompletion ? 0 : revenue,
    currencyCode: 'PLN',
    notes: input.commercial.notes,
    resourceId: input.resourceId || undefined,
    assignmentId: input.assignmentId || undefined,
    status: input.status ?? 'completed',
    metadata,
    ...(!isReceiptCompletion &&
    input.commercial.tripType === 'client' &&
    input.commercial.customerEntityId
      ? { customerEntityId: input.commercial.customerEntityId }
      : {}),
    ...(documentNumber ? { receiptDocumentNumber: documentNumber } : {}),
    ...(input.commercial.receiptAttachmentId
      ? { receiptAttachmentId: input.commercial.receiptAttachmentId }
      : {}),
    ...(input.commercial.receiptBlobId ? { receiptBlobId: input.commercial.receiptBlobId } : {}),
  }

  if (input.serverTripId) {
    return { ...base, id: input.serverTripId }
  }
  return base
}

export function toDateTimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromDateTimeLocalValue(value: string): string {
  return value ? new Date(value).toISOString() : new Date().toISOString()
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
