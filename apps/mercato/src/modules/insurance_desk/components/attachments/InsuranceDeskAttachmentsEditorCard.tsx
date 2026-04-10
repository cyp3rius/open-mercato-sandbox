"use client"

import * as React from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@open-mercato/ui/primitives/button'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { AttachmentsSection } from '@open-mercato/ui/backend/detail'
import { AttachmentItemsPreview } from './AttachmentItemsPreview'
import { LeadAttachmentsPanel } from '../leads/LeadAttachmentsPanel'
import { PolicyAttachmentsPanel } from '../policies/PolicyAttachmentsPanel'

type EditVariant = 'platform' | 'lead' | 'policy'

type Props = {
  entityId: string
  recordId: string | null
  title: string
  description?: string
  /** How the edit surface is rendered (platform AttachmentsSection vs insurance-tagged panels). */
  editVariant?: EditVariant
  /** When editVariant is lead/policy, uploads are allowed. */
  canUpload?: boolean
  className?: string
}

/**
 * Inline preview (Item-style list) + pencil; edit uses Open Mercato attachment UI.
 */
export function InsuranceDeskAttachmentsEditorCard({
  entityId,
  recordId,
  title,
  description,
  editVariant = 'platform',
  canUpload = true,
  className,
}: Props) {
  const t = useT()
  const [editing, setEditing] = React.useState(false)

  const editBody =
    editVariant === 'lead' && recordId ? (
      <LeadAttachmentsPanel leadId={recordId} canUpload={canUpload} embedded />
    ) : editVariant === 'policy' && recordId ? (
      <PolicyAttachmentsPanel policyId={recordId} embedded />
    ) : (
      <AttachmentsSection
        entityId={entityId}
        recordId={recordId}
        showHeader={false}
        compact
        title=""
        description=""
      />
    )

  return (
    <section className={cn('space-y-3 rounded-lg border bg-card p-4 shadow-sm', className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <h3 className="text-sm font-semibold leading-tight">{title}</h3>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {!editing ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => setEditing(true)}
            aria-label={t('insurance_desk.leads.detail.editSection', 'Edit section')}
          >
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setEditing(false)}>
            {t('common.close', 'Close')}
          </Button>
        )}
      </div>
      {editing ? (
        <div className="pt-1">{editBody}</div>
      ) : (
        <div className="rounded-md border border-dashed bg-muted/20 px-3 py-3 text-sm">
          <AttachmentItemsPreview entityId={entityId} recordId={recordId} />
        </div>
      )}
    </section>
  )
}
