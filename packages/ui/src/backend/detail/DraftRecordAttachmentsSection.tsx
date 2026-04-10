"use client"

import * as React from 'react'
import { AttachmentsSection } from './AttachmentsSection'

export type DraftRecordAttachmentsSectionProps = {
  entityId: string
  /** Persisted record id (e.g. edit mode). When set, attachments bind here. */
  persistedRecordId: string | null
  /**
   * Client UUID for pre-save uploads (`/api/attachments`), same pattern as Insurance Desk create flows.
   * Set when opening “create” (e.g. `crypto.randomUUID()`); omit or null only if uploads are disabled until save.
   */
  draftRecordId: string | null
  title?: string
  description?: string
  className?: string
  showHeader?: boolean
  compact?: boolean
  onChanged?: () => void
}

/**
 * Wraps {@link AttachmentsSection} with `recordId = persistedRecordId ?? draftRecordId`
 * so files can be uploaded before the server row exists. After save, call
 * {@link transferDraftAttachmentsToRecord} from `@open-mercato/ui/backend/utils/transferDraftAttachments`.
 */
export function DraftRecordAttachmentsSection({
  persistedRecordId,
  draftRecordId,
  ...rest
}: DraftRecordAttachmentsSectionProps) {
  return (
    <AttachmentsSection {...rest} recordId={persistedRecordId ?? draftRecordId} />
  )
}
