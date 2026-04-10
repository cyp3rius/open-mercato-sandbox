import { apiCall } from './apiCall'

/**
 * Moves all attachments from a draft `recordId` (e.g. client UUID used before the record exists)
 * to the persisted record id via `POST /api/attachments/transfer`.
 */
export async function transferDraftAttachmentsToRecord(
  entityId: string,
  draftRecordId: string,
  targetRecordId: string,
): Promise<void> {
  if (!draftRecordId.trim() || !targetRecordId.trim() || draftRecordId === targetRecordId) return

  const list = await apiCall<{ items?: Array<{ id: string }> }>(
    `/api/attachments?entityId=${encodeURIComponent(entityId)}&recordId=${encodeURIComponent(draftRecordId)}`,
    undefined,
    { fallback: { items: [] } },
  )
  const ids = (Array.isArray(list.result?.items) ? list.result.items : [])
    .map((i) => i.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
  if (!ids.length) return

  const transfer = await apiCall<{ ok?: boolean; error?: string }>(
    '/api/attachments/transfer',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        entityId,
        attachmentIds: ids,
        fromRecordId: draftRecordId,
        toRecordId: targetRecordId,
      }),
    },
    { fallback: null },
  )
  if (!transfer.ok) {
    throw new Error(transfer.result?.error || 'transfer_failed')
  }
}
