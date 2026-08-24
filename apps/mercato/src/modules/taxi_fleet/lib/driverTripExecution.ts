import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'

const DRIVER_UPDATE_IGNORED_KEYS = new Set(['id', 'clientMutationId'])

export type DriverTripExecutionAction =
  | 'pricing'
  | 'start'
  | 'complete'
  | 'live_update'
  | 'receipt_supplement'

const RECEIPT_SUPPLEMENT_KEYS = new Set([
  'receiptAttachmentId',
  'receiptDocumentNumber',
  'completionMode',
])

function presentKeys(body: Record<string, unknown>): string[] {
  return Object.keys(body).filter((key) => {
    if (DRIVER_UPDATE_IGNORED_KEYS.has(key)) return false
    return body[key] !== undefined
  })
}

/**
 * Restricts driver trip updates:
 * - `scheduled`: only price/distance, or start (overwrite startedAt → in_progress)
 * - `in_progress`: complete with endedAt only, or full live-trip finish payload
 * - `completed`: supplement receipt when none is attached yet
 * - other statuses: no writes
 */
export function resolveDriverTripUpdateInput(
  currentStatus: string,
  body: Record<string, unknown>,
): { action: DriverTripExecutionAction; input: Record<string, unknown> } {
  const status = String(currentStatus ?? '').trim()
  const keys = presentKeys(body)
  const id = typeof body.id === 'string' ? body.id : null
  if (!id) throw new CrudHttpError(400, { error: 'Missing trip id' })

  if (status === 'scheduled') {
    const isStart =
      keys.includes('startedAt') &&
      keys.includes('status') &&
      body.status === 'in_progress' &&
      keys.every((key) => key === 'startedAt' || key === 'status')
    if (isStart) {
      return {
        action: 'start',
        input: {
          id,
          startedAt: body.startedAt,
          status: 'in_progress',
        },
      }
    }
    const isPricing = keys.length > 0 && keys.every((key) => key === 'revenueAmount' || key === 'distanceKm')
    if (isPricing) {
      const input: Record<string, unknown> = { id }
      if (body.revenueAmount !== undefined) input.revenueAmount = body.revenueAmount
      if (body.distanceKm !== undefined) input.distanceKm = body.distanceKm
      return { action: 'pricing', input }
    }
    throw new CrudHttpError(400, {
      error: 'Scheduled trips only allow price/distance edits or start.',
    })
  }

  if (status === 'in_progress') {
    const isComplete =
      keys.includes('endedAt') &&
      keys.includes('status') &&
      body.status === 'completed' &&
      keys.every((key) => key === 'endedAt' || key === 'status')
    if (isComplete) {
      return {
        action: 'complete',
        input: {
          id,
          endedAt: body.endedAt,
          status: 'completed',
        },
      }
    }
    return {
      action: 'live_update',
      input: body,
    }
  }

  if (status === 'completed') {
    const isReceiptSupplement =
      keys.includes('receiptAttachmentId') &&
      typeof body.receiptAttachmentId === 'string' &&
      body.receiptAttachmentId.trim().length > 0 &&
      keys.every((key) => RECEIPT_SUPPLEMENT_KEYS.has(key))
    if (isReceiptSupplement) {
      return { action: 'receipt_supplement', input: { id } }
    }
  }

  throw new CrudHttpError(409, {
    error: 'Trip cannot be updated in the current status.',
  })
}
