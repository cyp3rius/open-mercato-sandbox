"use client"

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, BookOpen, GripVertical, Plus, Waypoints } from 'lucide-react'
import { Button } from '@open-mercato/ui/primitives/button'
import { Label } from '@open-mercato/ui/primitives/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@open-mercato/ui/primitives/dialog'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCall, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { raiseCrudError } from '@open-mercato/ui/backend/utils/serverErrors'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import type { EntitySearchComboboxOption } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { Spinner } from '@open-mercato/ui/primitives/spinner'
import { cn } from '@open-mercato/shared/lib/utils'
import {
  renderDictionaryColor,
  renderDictionaryIcon,
} from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'
import { DictionaryEntrySelect } from '@open-mercato/core/modules/dictionaries/components/DictionaryEntrySelect'
import type { DictionaryOption } from '@open-mercato/core/modules/dictionaries/components/DictionaryEntrySelect'
import { PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY } from '../lib/dictionaryKeys'
import { fetchDictionaryOptionsByKey } from '../lib/fetchDictionaryOptionsByKey'
import { procurementDictionarySelectLabels } from '../lib/procurementDictionarySelectLabels'
import { mergeEntitySearchOption } from '../lib/procurementEntitySearch'

type RuleRow = {
  id: string
  fromStatusValue: string
  toStatusValue: string
  fromStatusLabel: string
  toStatusLabel: string
  sortOrder: number
  automationWorkflowId: string | null
  automationWorkflowLabel: string | null
}

type DialogState = { mode: 'create' } | { mode: 'edit'; row: RuleRow }

const DICT_HREF = `/backend/config/dictionaries?key=${encodeURIComponent(PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY)}`

function reorderById(items: RuleRow[], dragId: string, targetId: string): RuleRow[] {
  const fromIndex = items.findIndex((r) => r.id === dragId)
  const toIndex = items.findIndex((r) => r.id === targetId)
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return items
  const next = [...items]
  const [removed] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, removed)
  return next
}

function StatusAppearanceChip(props: { option?: DictionaryOption; text: string }) {
  const { option, text } = props
  return (
    <span className="flex min-w-0 max-w-[min(100%,12rem)] items-center gap-1.5">
      {option?.color?.trim() ? (
        <span className="shrink-0">{renderDictionaryColor(option.color.trim(), 'h-3 w-3 rounded-sm')}</span>
      ) : null}
      {option?.icon?.trim() ? (
        <span className="inline-flex size-5 shrink-0 items-center justify-center text-muted-foreground">
          {renderDictionaryIcon(option.icon, 'size-4')}
        </span>
      ) : null}
      <span className="min-w-0 truncate text-sm font-medium">{text}</span>
    </span>
  )
}

async function enrichWorkflowLabels(rows: RuleRow[]): Promise<RuleRow[]> {
  const ids = [
    ...new Set(rows.map((r) => r.automationWorkflowId).filter((x): x is string => Boolean(x))),
  ]
  if (!ids.length) {
    return rows.map((r) => ({ ...r, automationWorkflowLabel: null }))
  }
  const labelById = new Map<string, string>()
  await Promise.all(
    ids.map(async (wid) => {
      const res = await apiCall<{ data?: Array<{ workflowId: string; workflowName: string }> }>(
        `/api/workflows/definitions?workflowId=${encodeURIComponent(wid)}&limit=1`,
      )
      const row = res.result?.data?.[0]
      if (row && res.ok) {
        labelById.set(wid, row.workflowName.trim() || row.workflowId)
      }
    }),
  )
  return rows.map((r) => ({
    ...r,
    automationWorkflowLabel: r.automationWorkflowId ? labelById.get(r.automationWorkflowId) ?? null : null,
  }))
}

export default function ProcurementStatusPipelineSettings(): React.ReactElement {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const dictLabels = React.useMemo(() => procurementDictionarySelectLabels(t, 'status'), [t])

  const [options, setOptions] = React.useState<DictionaryOption[]>([])
  const [items, setItems] = React.useState<RuleRow[]>([])
  const itemsRef = React.useRef(items)
  React.useEffect(() => {
    itemsRef.current = items
  }, [items])

  const [loading, setLoading] = React.useState(true)
  const [reordering, setReordering] = React.useState(false)
  const [dialog, setDialog] = React.useState<DialogState | null>(null)
  const [saving, setSaving] = React.useState(false)

  const [fromValue, setFromValue] = React.useState('')
  const [toValue, setToValue] = React.useState('')
  const [workflowId, setWorkflowId] = React.useState('')
  const [workflowDisplayLabel, setWorkflowDisplayLabel] = React.useState('')

  const [draggingId, setDraggingId] = React.useState<string | null>(null)

  const fetchStatusOptions = React.useCallback(
    () => fetchDictionaryOptionsByKey(PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY),
    [scopeVersion],
  )

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const rows = await fetchDictionaryOptionsByKey(PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY)
      if (!cancelled) setOptions(rows)
    })()
    return () => {
      cancelled = true
    }
  }, [scopeVersion])

  const loadRules = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await readApiResultOrThrow<{ items?: RuleRow[] }>(
        '/api/procurement/status-transition-rules',
        undefined,
        {
          errorMessage: t(
            'procurement.settings.statusPipeline.loadFailed',
            'Failed to load status transition rules.',
          ),
          fallback: { items: [] },
        },
      )
      const raw = Array.isArray(data?.items) ? data.items : []
      const mapped: RuleRow[] = raw.map((r) => ({
        id: String(r.id ?? ''),
        fromStatusValue: String(r.fromStatusValue ?? ''),
        toStatusValue: String(r.toStatusValue ?? ''),
        fromStatusLabel: String(r.fromStatusLabel ?? r.fromStatusValue ?? ''),
        toStatusLabel: String(r.toStatusLabel ?? r.toStatusValue ?? ''),
        sortOrder: typeof r.sortOrder === 'number' ? r.sortOrder : 0,
        automationWorkflowId:
          r.automationWorkflowId === null || r.automationWorkflowId === undefined
            ? null
            : String(r.automationWorkflowId),
        automationWorkflowLabel: null,
      }))
      const enriched = await enrichWorkflowLabels(mapped)
      setItems(enriched)
    } finally {
      setLoading(false)
    }
  }, [t])

  React.useEffect(() => {
    void loadRules()
  }, [loadRules, scopeVersion])

  const persistReorder = React.useCallback(
    async (ordered: RuleRow[]) => {
      setReordering(true)
      try {
        const res = await apiCall('/api/procurement/status-transition-rules/reorder', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ orderedIds: ordered.map((r) => r.id) }),
        })
        if (!res.ok) {
          await raiseCrudError(
            res.response,
            t('procurement.settings.statusPipeline.reorderFailed', 'Failed to save order.'),
          )
          await loadRules()
          return
        }
        setItems(ordered.map((r, i) => ({ ...r, sortOrder: i * 10 })))
      } finally {
        setReordering(false)
      }
    },
    [loadRules, t],
  )

  const openCreate = React.useCallback(() => {
    const sorted = [...options].sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
    setFromValue(sorted[0]?.value ?? '')
    setToValue(sorted[1]?.value ?? sorted[0]?.value ?? '')
    setWorkflowId('')
    setWorkflowDisplayLabel('')
    setDialog({ mode: 'create' })
  }, [options])

  const openEdit = React.useCallback((row: RuleRow) => {
    setFromValue(row.fromStatusValue)
    setToValue(row.toStatusValue)
    setWorkflowId(row.automationWorkflowId ?? '')
    setWorkflowDisplayLabel(
      row.automationWorkflowLabel ?? row.automationWorkflowId ?? '',
    )
    setDialog({ mode: 'edit', row })
  }, [])

  const closeDialog = React.useCallback(() => {
    setDialog(null)
  }, [])

  const resolveWorkflowDisplayLabel = React.useCallback(async (id: string) => {
    const trimmed = id.trim()
    if (!trimmed.length) {
      setWorkflowDisplayLabel('')
      return
    }
    const res = await apiCall<{ data?: Array<{ workflowId: string; workflowName: string }> }>(
      `/api/workflows/definitions?workflowId=${encodeURIComponent(trimmed)}&limit=1`,
    )
    const row = res.result?.data?.[0]
    if (row && res.ok) {
      setWorkflowDisplayLabel(row.workflowName.trim() || row.workflowId)
      return
    }
    setWorkflowDisplayLabel(trimmed)
  }, [])

  const searchWorkflows = React.useCallback(async (query: string) => {
    const q = query.trim()
    const url = q.length
      ? `/api/workflows/definitions?search=${encodeURIComponent(q)}&enabled=true&limit=30`
      : `/api/workflows/definitions?enabled=true&limit=30`
    const res = await apiCall<{ data?: Array<{ workflowId: string; workflowName: string }> }>(url)
    if (!res.ok) return []
    const rows = res.result?.data ?? []
    return rows.map(
      (w): EntitySearchComboboxOption => ({
        value: w.workflowId,
        label: w.workflowName.trim() || w.workflowId,
        description: w.workflowName.trim() && w.workflowName.trim() !== w.workflowId ? w.workflowId : null,
      }),
    )
  }, [])

  const workflowComboboxOptions = React.useMemo(
    () => mergeEntitySearchOption([], workflowId.trim(), workflowDisplayLabel.trim() || workflowId.trim()),
    [workflowId, workflowDisplayLabel],
  )

  const submit = React.useCallback(async () => {
    if (!fromValue.trim() || !toValue.trim()) {
      flash(t('procurement.settings.statusPipeline.missingFields', 'Choose both statuses.'), 'error')
      return
    }
    if (fromValue.trim() === toValue.trim()) {
      flash(t('procurement.settings.statusPipeline.sameEnds', 'From and to must be different.'), 'error')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        fromStatusValue: fromValue.trim(),
        toStatusValue: toValue.trim(),
        automationWorkflowId: workflowId.trim().length ? workflowId.trim() : null,
      }
      const current = itemsRef.current
      if (dialog?.mode === 'create') {
        const maxSort = current.reduce((m, r) => Math.max(m, r.sortOrder), 0)
        payload.sortOrder = current.length === 0 ? 0 : maxSort + 10
      }

      if (dialog?.mode === 'create') {
        const res = await apiCall('/api/procurement/status-transition-rules', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          await raiseCrudError(
            res.response,
            t('procurement.settings.statusPipeline.saveFailed', 'Failed to save.'),
          )
          return
        }
        flash(t('procurement.settings.statusPipeline.created', 'Transition added.'), 'success')
      } else if (dialog?.mode === 'edit') {
        const res = await apiCall(`/api/procurement/status-transition-rules/${encodeURIComponent(dialog.row.id)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          await raiseCrudError(
            res.response,
            t('procurement.settings.statusPipeline.saveFailed', 'Failed to save.'),
          )
          return
        }
        flash(t('procurement.settings.statusPipeline.updated', 'Transition updated.'), 'success')
      }
      closeDialog()
      await loadRules()
    } finally {
      setSaving(false)
    }
  }, [closeDialog, dialog, fromValue, loadRules, t, toValue, workflowId])

  const handleDelete = React.useCallback(
    async (row: RuleRow) => {
      const ok = await confirm({
        title: t('procurement.settings.statusPipeline.deleteTitle', 'Remove transition'),
        text: t(
          'procurement.settings.statusPipeline.deleteDesc',
          'Remove this allowed transition? Existing processes keep their current status.',
        ),
        confirmText: t('procurement.settings.statusPipeline.deleteConfirm', 'Remove'),
        variant: 'destructive',
      })
      if (!ok) return
      const res = await apiCall(`/api/procurement/status-transition-rules/${encodeURIComponent(row.id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        await raiseCrudError(
          res.response,
          t('procurement.settings.statusPipeline.deleteFailed', 'Failed to remove.'),
        )
        return
      }
      flash(t('procurement.settings.statusPipeline.deleted', 'Transition removed.'), 'success')
      await loadRules()
    },
    [confirm, loadRules, t],
  )

  const optionByValue = React.useMemo(() => new Map(options.map((o) => [o.value, o])), [options])

  return (
    <div className="space-y-4">
      {ConfirmDialogElement}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h2 className="text-lg font-semibold">
          {t('procurement.settings.statusPipeline.title', 'Procurement status pipeline')}
        </h2>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={DICT_HREF} target="_blank" rel="noopener noreferrer">
              <BookOpen className="size-4 shrink-0" aria-hidden />
              {t('procurement.settings.statusPipeline.dictButton', 'Statuses')}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/backend/definitions" target="_blank" rel="noopener noreferrer">
              <Waypoints className="size-4 shrink-0" aria-hidden />
              {t('procurement.settings.statusPipeline.workflowsButton', 'Workflow definitions')}
            </Link>
          </Button>
          <Button type="button" size="sm" className="gap-2" onClick={() => void openCreate()}>
            <Plus className="size-4 shrink-0" aria-hidden />
            {t('procurement.settings.statusPipeline.add', 'Add transition')}
          </Button>
        </div>
      </div>
      <div className="space-y-2 text-muted-foreground text-sm">
        <p className="w-full">
          {t(
            'procurement.settings.statusPipeline.lead',
            'Define which status changes are allowed for procurement processes. Leave the list empty to allow any status from the dictionary (legacy behavior). Values come from the procurement process status dictionary.',
          )}
        </p>
        <p className="w-full">
          {t(
            'procurement.settings.statusPipeline.workflowHint',
            'Optional: run an automation workflow after each allowed transition (pick a workflow below).',
          )}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="w-11 px-1 py-2 font-medium" aria-hidden />
                <th className="px-3 py-2 font-medium">
                  {t('procurement.settings.statusPipeline.colTransition', 'Transition')}
                </th>
                <th className="px-3 py-2 font-medium">
                  {t('procurement.settings.statusPipeline.colWorkflow', 'Workflow')}
                </th>
                <th className="w-40 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                    {t(
                      'procurement.settings.statusPipeline.empty',
                      'No rules — any status change is allowed. Add rows to enforce a pipeline.',
                    )}
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const fromOpt = optionByValue.get(row.fromStatusValue)
                  const toOpt = optionByValue.get(row.toStatusValue)
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        'border-b border-border/60 last:border-0',
                        draggingId === row.id && 'opacity-60',
                      )}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        const dragSource = e.dataTransfer.getData('text/plain')
                        if (!dragSource || dragSource === row.id) {
                          setDraggingId(null)
                          return
                        }
                        const next = reorderById(itemsRef.current, dragSource, row.id)
                        setItems(next)
                        setDraggingId(null)
                        void persistReorder(next)
                      }}
                    >
                      <td className="w-11 px-1 py-1.5 align-middle">
                        <button
                          type="button"
                          draggable
                          aria-label={t('procurement.settings.statusPipeline.dragHandle', 'Reorder')}
                          title={t('procurement.settings.statusPipeline.dragHandle', 'Reorder')}
                          disabled={reordering}
                          className={cn(
                            'flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors',
                            'cursor-grab active:cursor-grabbing hover:bg-muted hover:text-foreground',
                            reordering && 'pointer-events-none opacity-50',
                          )}
                          onDragStart={(e) => {
                            e.stopPropagation()
                            setDraggingId(row.id)
                            e.dataTransfer.setData('text/plain', row.id)
                            e.dataTransfer.effectAllowed = 'move'
                          }}
                          onDragEnd={() => {
                            setDraggingId(null)
                          }}
                        >
                          <GripVertical className="size-4" aria-hidden />
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <StatusAppearanceChip option={fromOpt} text={row.fromStatusLabel} />
                          <ArrowRight
                            className="size-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <StatusAppearanceChip option={toOpt} text={row.toStatusLabel} />
                        </div>
                      </td>
                      <td className="px-3 py-2 align-middle">
                        {row.automationWorkflowId ? (
                          <span className="text-sm" title={row.automationWorkflowId}>
                            {row.automationWorkflowLabel ?? (
                              <span className="font-mono text-xs">{row.automationWorkflowId}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right align-middle">
                        <span className="space-x-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => openEdit(row)}>
                            {t('common.edit', 'Edit')}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDelete(row)}
                          >
                            {t('common.delete', 'Delete')}
                          </Button>
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {dialog?.mode === 'edit'
                ? t('procurement.settings.statusPipeline.dialogEdit', 'Edit transition')
                : t('procurement.settings.statusPipeline.dialogCreate', 'New transition')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            <div
              className={cn(
                'grid grid-cols-1 gap-y-3',
                'sm:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] sm:gap-x-3 sm:gap-y-1.5',
              )}
            >
              <Label className="sm:col-start-1 sm:row-start-1">
                {t('procurement.settings.statusPipeline.fieldFrom', 'From status')}
              </Label>
              <div className="min-w-0 sm:col-start-1 sm:row-start-2">
                <DictionaryEntrySelect
                  value={fromValue || undefined}
                  onChange={(next) => setFromValue(next ?? '')}
                  fetchOptions={fetchStatusOptions}
                  labels={dictLabels}
                  allowInlineCreate={false}
                  showManage={false}
                  allowAppearance
                  selectClassName="w-full"
                />
              </div>
              <div
                className="flex justify-center py-0.5 sm:col-start-2 sm:row-start-2 sm:items-center sm:justify-center sm:py-0"
                aria-hidden
              >
                <ArrowRight className="size-5 text-muted-foreground" />
              </div>
              <Label className="sm:col-start-3 sm:row-start-1">
                {t('procurement.settings.statusPipeline.fieldTo', 'To status')}
              </Label>
              <div className="min-w-0 sm:col-start-3 sm:row-start-2">
                <DictionaryEntrySelect
                  value={toValue || undefined}
                  onChange={(next) => setToValue(next ?? '')}
                  fetchOptions={fetchStatusOptions}
                  labels={dictLabels}
                  allowInlineCreate={false}
                  showManage={false}
                  allowAppearance
                  selectClassName="w-full"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pstp-wf">
                {t('procurement.settings.statusPipeline.fieldWorkflow', 'Run workflow')}
              </Label>
              <EntitySearchCombobox
                value={workflowId}
                onChange={(next) => {
                  setWorkflowId(next)
                  void resolveWorkflowDisplayLabel(next)
                }}
                options={workflowComboboxOptions}
                placeholder={t(
                  'procurement.settings.statusPipeline.fieldWorkflowPh',
                  'Search workflows…',
                )}
                searchPlaceholder={t(
                  'procurement.settings.statusPipeline.fieldWorkflowSearchPh',
                  'Search by name or id…',
                )}
                onRemoteSearch={searchWorkflows}
                selectedDisplayOverride={workflowDisplayLabel.trim() || undefined}
                className="w-full"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="button" disabled={saving} onClick={() => void submit()}>
              {saving ? t('common.saving', 'Saving…') : t('common.save', 'Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
