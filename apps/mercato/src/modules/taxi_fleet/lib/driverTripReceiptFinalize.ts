import type { EntityManager } from '@mikro-orm/postgresql'
import type { CommandBus, CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import { maybeEnsureCompanyForExtraction } from './receiptExtractionCompany'
import {
  applyReceiptExtractionToLinkedRecords,
  linkReceiptExtractionToTrip,
} from './receiptExtractionPipeline'
import type { DriverTripCompletionMode } from './driverTripReceiptStatus'

export type DriverTripReceiptInput = {
  receiptDocumentNumber?: string | null
  receiptAttachmentId?: string | null
  completionMode?: DriverTripCompletionMode | null
}

export function isReceiptOnlyTripCompletion(
  input: DriverTripReceiptInput,
): boolean {
  return input.completionMode === 'receipt' && Boolean(input.receiptAttachmentId)
}

export function normalizeReceiptCompletionCreateBody(
  body: Record<string, unknown>,
  receipt: DriverTripReceiptInput,
): Record<string, unknown> {
  if (!isReceiptOnlyTripCompletion(receipt)) return body

  const existingMetadata =
    body.metadata && typeof body.metadata === 'object'
      ? (body.metadata as Record<string, unknown>)
      : {}

  return {
    ...body,
    tripType: 'other',
    platform: body.platform ?? null,
    revenueAmount: 0,
    customerEntityId: undefined,
    customerPersonId: undefined,
    customerCompanyId: undefined,
    metadata: {
      ...existingMetadata,
      receiptCompletionMode: 'receipt',
      ...(receipt.receiptAttachmentId
        ? { receiptAttachmentId: receipt.receiptAttachmentId }
        : {}),
      ...(receipt.receiptDocumentNumber
        ? { receiptDocumentNumber: receipt.receiptDocumentNumber }
        : {}),
    },
  }
}

export async function finalizeDriverTripReceipt(params: {
  em: EntityManager
  commandBus: CommandBus
  ctx: CommandRuntimeContext
  tenantId: string
  organizationId: string
  tripId: string
  receiptAttachmentId: string
  receiptDocumentNumber?: string | null
  tripRevenueAmount?: number | null
  financialEntryId?: string | null
}): Promise<void> {
  const extraction = await linkReceiptExtractionToTrip(params.em, {
    attachmentId: params.receiptAttachmentId,
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    tripId: params.tripId,
    financialEntryId: params.financialEntryId ?? null,
    driverDocumentNumber: params.receiptDocumentNumber ?? null,
    tripRevenueAmount: params.tripRevenueAmount ?? null,
  })
  if (!extraction) return

  await maybeEnsureCompanyForExtraction({
    em: params.em,
    commandBus: params.commandBus,
    ctx: params.ctx,
    extraction,
  })
  await applyReceiptExtractionToLinkedRecords(params.em, extraction.id, {
    tripRevenueAmount: params.tripRevenueAmount ?? null,
  })
}
