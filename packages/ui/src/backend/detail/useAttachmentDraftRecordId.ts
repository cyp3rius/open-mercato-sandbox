"use client"

import * as React from 'react'

/**
 * Stable client UUID for attachment uploads before the persisted record exists
 * (same idea as `attachmentDraftRecordId` on Insurance Desk policy/lead create pages).
 *
 * Call `startNewDraft()` when opening a new create dialog/session so each draft gets a fresh `recordId`.
 */
export function useAttachmentDraftRecordId(): {
  draftRecordId: string
  startNewDraft: () => void
} {
  const [draftRecordId, setDraftRecordId] = React.useState(() => crypto.randomUUID())
  const startNewDraft = React.useCallback(() => {
    setDraftRecordId(crypto.randomUUID())
  }, [])
  return { draftRecordId, startNewDraft }
}
