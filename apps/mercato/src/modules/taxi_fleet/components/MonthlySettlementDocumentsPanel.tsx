'use client'

import * as React from 'react'
import { Trash2, Upload } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeDetail } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { Button } from '@open-mercato/ui/primitives/button'
import { CRUD_FORM_SELECT_CLASS, CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { createCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'

type DocumentRow = {
  id: string
  monthStart: string
  kind: string
  resourceId?: string | null
  fileName?: string | null
  notes?: string | null
  attachmentId?: string | null
}

type MonthlySettlementDocumentsPanelProps = {
  monthStart: string
  canManage: boolean
}

const KINDS = ['cash_register', 'fuel', 'treasury', 'other'] as const

export function MonthlySettlementDocumentsPanel({
  monthStart,
  canManage,
}: MonthlySettlementDocumentsPanelProps) {
  const t = useT()
  const { organizationId, tenantId } = useOrganizationScopeDetail()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [rows, setRows] = React.useState<DocumentRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [kind, setKind] = React.useState<(typeof KINDS)[number]>('cash_register')
  const [resourceId, setResourceId] = React.useState('')
  const [fileName, setFileName] = React.useState('')
  const [notes, setNotes] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      page: '1',
      pageSize: '100',
      monthStart,
      sortField: 'createdAt',
      sortDir: 'desc',
    })
    const call = await apiCall<{ items: DocumentRow[] }>(
      `/api/taxi_fleet/monthly-settlement-documents?${params}`,
    )
    setRows(Array.isArray(call.result?.items) ? call.result.items : [])
    setLoading(false)
  }, [monthStart])

  React.useEffect(() => {
    void load()
  }, [load])

  const handleCreate = React.useCallback(async () => {
    if (!organizationId || !tenantId) return
    if (kind === 'cash_register' && !resourceId.trim()) {
      flash(
        t(
          'taxi_fleet.monthlySettlements.documents.errors.resourceRequired',
          'Cash register uploads require a vehicle (resource) id.',
        ),
        'error',
      )
      return
    }
    setSaving(true)
    try {
      await createCrud(
        'taxi_fleet/monthly-settlement-documents',
        {
          tenantId,
          organizationId,
          monthStart,
          kind,
          resourceId: resourceId.trim() || null,
          fileName: fileName.trim() || null,
          notes: notes.trim() || null,
        },
        {
          errorMessage: t(
            'taxi_fleet.monthlySettlements.documents.saveError',
            'Could not save document metadata.',
          ),
        },
      )
      flash(
        t(
          'taxi_fleet.monthlySettlements.documents.saved',
          'Document recorded. Amount verification vs CRM comes in a later phase.',
        ),
        'success',
      )
      setFileName('')
      setNotes('')
      setResourceId('')
      await load()
    } finally {
      setSaving(false)
    }
  }, [fileName, kind, load, monthStart, notes, organizationId, resourceId, t, tenantId])

  const handleDelete = React.useCallback(
    async (row: DocumentRow) => {
      const ok = await confirm({
        title: t('taxi_fleet.monthlySettlements.documents.deleteConfirm', 'Delete this document record?'),
        variant: 'destructive',
      })
      if (!ok) return
      await deleteCrud('taxi_fleet/monthly-settlement-documents', row.id, {
        errorMessage: t('taxi_fleet.monthlySettlements.documents.deleteError', 'Could not delete document.'),
      })
      flash(t('taxi_fleet.monthlySettlements.documents.deleted', 'Document deleted.'), 'success')
      await load()
    },
    [confirm, load, t],
  )

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t(
          'taxi_fleet.monthlySettlements.documents.hint',
          'Upload metadata for cash register (per vehicle), fuel, treasury, and other month files. Automatic amount verification against CRM is not enabled yet.',
        )}
      </p>

      {canManage ? (
        <section className="rounded-lg border bg-card px-4 py-3 space-y-3">
          <h3 className="text-sm font-semibold">
            {t('taxi_fleet.monthlySettlements.documents.add', 'Add document')}
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">{t('taxi_fleet.monthlySettlements.documents.kind', 'Kind')}</span>
              <select
                className={CRUD_FORM_SELECT_CLASS}
                value={kind}
                onChange={(event) => setKind(event.target.value as (typeof KINDS)[number])}
              >
                {KINDS.map((value) => (
                  <option key={value} value={value}>
                    {t(`taxi_fleet.monthlySettlements.documents.kinds.${value}`, value)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">
                {t('taxi_fleet.monthlySettlements.documents.resourceId', 'Vehicle resource id')}
              </span>
              <input
                className={CRUD_FORM_TEXT_INPUT_CLASS}
                value={resourceId}
                onChange={(event) => setResourceId(event.target.value)}
                placeholder={kind === 'cash_register' ? 'required for cash register' : 'optional'}
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="font-medium">{t('taxi_fleet.monthlySettlements.documents.fileName', 'File name')}</span>
              <input
                className={CRUD_FORM_TEXT_INPUT_CLASS}
                value={fileName}
                onChange={(event) => setFileName(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="font-medium">{t('taxi_fleet.monthlySettlements.documents.notes', 'Notes')}</span>
              <input
                className={CRUD_FORM_TEXT_INPUT_CLASS}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
          </div>
          <Button type="button" size="sm" disabled={saving} onClick={() => void handleCreate()}>
            <Upload className="mr-2 size-4" aria-hidden />
            {t('taxi_fleet.monthlySettlements.documents.submit', 'Save document')}
          </Button>
        </section>
      ) : null}

      <section className="rounded-lg border bg-card px-4 py-3">
        <h3 className="text-sm font-semibold mb-3">
          {t('taxi_fleet.monthlySettlements.documents.list', 'Documents for this month')}
        </h3>
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('taxi_fleet.monthlySettlements.documents.empty', 'No documents uploaded yet.')}
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium">
                    {t(`taxi_fleet.monthlySettlements.documents.kinds.${row.kind}`, row.kind)}
                    {row.fileName ? ` · ${row.fileName}` : ''}
                  </p>
                  {row.resourceId ? (
                    <p className="text-muted-foreground tabular-nums">{row.resourceId}</p>
                  ) : null}
                  {row.notes ? <p className="text-muted-foreground">{row.notes}</p> : null}
                </div>
                {canManage ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleDelete(row)}
                    aria-label={t('common.delete', 'Delete')}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      {ConfirmDialogElement}
    </div>
  )
}
