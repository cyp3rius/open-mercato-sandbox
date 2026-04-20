"use client"

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ExternalLink, Pencil } from 'lucide-react'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import {
  CRUD_FORM_TEXT_INPUT_CLASS,
  CRUD_FORM_TEXTAREA_CLASS,
} from '@open-mercato/ui/backend/CrudForm'
import { Button } from '@open-mercato/ui/primitives/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@open-mercato/ui/primitives/dialog'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { createCrud, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import {
  DetailFieldsSection,
  type DetailFieldConfig,
  ErrorMessage,
  InlineMultilineEditor,
  InlineSelectEditor,
  type InlineSelectOption,
  InlineTextEditor,
  LoadingMessage,
} from '@open-mercato/ui/backend/detail'
import { AttachmentsSection } from '@open-mercato/ui/backend/detail/AttachmentsSection'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import { DateTimePicker } from '@open-mercato/ui/backend/inputs/DateTimePicker'
import {
  DictionaryEntrySelect,
  type DictionaryOption,
} from '@open-mercato/core/modules/dictionaries/components/DictionaryEntrySelect'
import { DetailTabsLayout } from '@open-mercato/core/modules/customers/components/detail/DetailTabsLayout'
import {
  DictionaryValue,
  createDictionaryMap,
  type DictionaryDisplayEntry,
} from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'
import { PROCUREMENT_PROCESS_ENTITY_TYPE } from '../../../../lib/entityTypes'
import { clearProcurementDictionaryIdCache, fetchDictionaryOptionsByKey } from '../../../../lib/fetchDictionaryOptionsByKey'
import { procurementDictionarySelectLabels } from '../../../../lib/procurementDictionarySelectLabels'
import {
  CATALOG_UNIT_DICTIONARY_KEY,
  PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY,
  PROCUREMENT_PROCESS_TYPE_DICTIONARY_KEY,
} from '../../../../lib/dictionaryKeys'
import {
  type CustomerCompanySupplierPreview,
  fetchCustomerCompanySupplierPreview,
  mergeEntitySearchOption,
  remoteSearchAuthUsers,
  remoteSearchCustomerCompanies,
  remoteSearchCustomerEntities,
  remoteSearchResources,
  remoteSearchSalesQuotes,
  resolveCustomerEntityDisplayLabel,
  resolveQuoteDisplayLabel,
  resolveResourceDisplayLabel,
  resolveUserDisplayLabel,
} from '../../../../lib/procurementEntitySearch'

type Paged<T> = { items: T[]; totalPages?: number }

type ProcessDetail = {
  id: string
  title: string
  description: string | null
  startedAt: string | null
  statusValue: string | null
  statusLabel: string | null
  statusColor: string | null
  statusIcon: string | null
  typeValue: string | null
  typeLabel: string | null
  typeColor: string | null
  typeIcon: string | null
  customerEntityId: string | null
  salesQuoteId: string | null
  salesInvoiceId: string | null
  resourceId: string | null
  selectedSupplierId: string | null
  refinancingEnabled?: boolean
  refinancingNotes: string | null
  closedAt: string | null
  updatedAt: string | null
}

type SupplierRow = {
  id: string
  vendorCustomerEntityId: string | null
  vendorLabel: string
  contactName: string | null
  email: string | null
  phone: string | null
  website: string | null
  notes: string | null
  offerSummary: string | null
}

type LineRow = {
  id: string
  title: string
  specification: string | null
  quantity: number | null
  unitLabel: string | null
}

type DetailTabId = 'details' | 'specification' | 'suppliers' | 'tasks' | 'history'

type TaskRow = {
  id: string
  supplierId: string | null
  title: string
  body: string | null
  taskStatus: string
  dueAt: string | null
  assignedUserId: string | null
}

type TimelineRow = {
  id: string
  processId: string
  eventType: string
  message: string
  createdAt: string | null
}

function optionalUuid(value: string): string | null {
  const s = value.trim()
  if (!s) return null
  return s
}

type StatusAdvanceTargets = {
  enforced: boolean
  items: { toStatusValue: string; toStatusLabel: string }[]
}

function ProcurementDictionaryInline({
  kind,
  process,
  allowEdits,
  patchProcess,
  statusAdvance,
  onAdvanceStatus,
}: {
  kind: 'status' | 'type'
  process: ProcessDetail
  allowEdits: boolean
  patchProcess: (patch: Record<string, unknown>) => Promise<void>
  statusAdvance?: StatusAdvanceTargets
  onAdvanceStatus?: (toStatusValue: string) => void | Promise<void>
}) {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const emptyLabel = t('procurement.processes.list.noValue', '—')
  const dictionaryKey =
    kind === 'status' ? PROCUREMENT_PROCESS_STATUS_DICTIONARY_KEY : PROCUREMENT_PROCESS_TYPE_DICTIONARY_KEY
  const labels = React.useMemo(
    () => procurementDictionarySelectLabels(t, kind === 'status' ? 'status' : 'type'),
    [kind, t],
  )
  const value = kind === 'status' ? process.statusValue : process.typeValue
  const snapshotEntry = React.useMemo((): DictionaryDisplayEntry | null => {
    if (kind === 'status') {
      const v = process.statusValue?.trim()
      if (!v) return null
      return {
        value: v,
        label: process.statusLabel ?? v,
        color: process.statusColor ?? null,
        icon: process.statusIcon ?? null,
      }
    }
    const v = process.typeValue?.trim()
    if (!v) return null
    return {
      value: v,
      label: process.typeLabel ?? v,
      color: process.typeColor ?? null,
      icon: process.typeIcon ?? null,
    }
  }, [kind, process])

  const [options, setOptions] = React.useState<DictionaryOption[]>([])
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const rows = await fetchDictionaryOptionsByKey(dictionaryKey)
      if (!cancelled) setOptions(rows)
    })()
    return () => {
      cancelled = true
    }
  }, [dictionaryKey, scopeVersion])

  const mapFromOptions = React.useMemo(
    () =>
      createDictionaryMap(
        options.map((o) => ({
          value: o.value,
          label: o.label,
          color: o.color ?? null,
          icon: o.icon ?? null,
        })),
      ),
    [options],
  )
  const displayMap = React.useMemo(() => {
    if (Object.keys(mapFromOptions).length) return mapFromOptions
    if (snapshotEntry) return createDictionaryMap([snapshotEntry])
    return {}
  }, [mapFromOptions, snapshotEntry])

  const selectOptions = React.useMemo<InlineSelectOption[]>(
    () => options.map((o) => ({ value: o.value, label: o.label })),
    [options],
  )

  const onSave = React.useCallback(
    async (next: string | null) => {
      const trimmed = typeof next === 'string' ? next.trim() : ''
      const payload = trimmed.length ? trimmed : null
      if (kind === 'status') {
        await patchProcess({ statusValue: payload })
      } else {
        await patchProcess({ typeValue: payload })
      }
    },
    [kind, patchProcess],
  )

  return (
    <div className="space-y-2">
      <InlineSelectEditor
        label={
          kind === 'status'
            ? t('procurement.processes.detail.status', 'Status')
            : t('procurement.processes.detail.type', 'Type')
        }
        value={value}
        emptyLabel={emptyLabel}
        options={selectOptions}
        onSave={onSave}
        variant="muted"
        activateOnClick={allowEdits}
        showEditTrigger={allowEdits}
        renderEditor={({ value: draft, onChange }) => (
          <DictionaryEntrySelect
            value={draft.trim() ? draft : undefined}
            onChange={(next) => onChange(next ?? '')}
            fetchOptions={() => fetchDictionaryOptionsByKey(dictionaryKey)}
            labels={labels}
            manageHref={`/backend/config/dictionaries?key=${encodeURIComponent(dictionaryKey)}`}
            allowInlineCreate={false}
            allowAppearance
            selectClassName="w-full"
            showLabelInput={false}
            disabled={!allowEdits}
          />
        )}
        renderDisplay={({ value: displayValue }) => (
          <DictionaryValue
            value={displayValue}
            map={displayMap}
            fallback={<span className="text-sm text-muted-foreground">{emptyLabel}</span>}
            className="text-sm"
            iconWrapperClassName="inline-flex h-6 w-6 items-center justify-center rounded border border-border bg-card"
            iconClassName="h-4 w-4"
            colorClassName="h-3 w-3 rounded-full"
          />
        )}
      />
      {kind === 'status' && allowEdits && statusAdvance?.enforced && statusAdvance.items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {statusAdvance.items.map((it) => (
            <Button
              key={it.toStatusValue}
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void onAdvanceStatus?.(it.toStatusValue)}
            >
              {t('procurement.processes.detail.statusAdvanceTo', 'Go to {{label}}', { label: it.toStatusLabel })}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function ProcurementProcessDetailPage({ params }: { params?: { id?: string } }) {
  const processId = typeof params?.id === 'string' ? params.id : ''
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const scopeVersion = useOrganizationScopeVersion()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const { runMutation } = useGuardedMutation<{ scopeVersion: number; processId: string }>({
    contextId: processId ? `procurement-process-detail-${processId}` : 'procurement-process-detail',
  })

  const withGuard = React.useCallback(
    (op: string, fn: () => Promise<unknown>) =>
      runMutation({
        context: { scopeVersion, processId },
        mutationPayload: { op },
        operation: fn,
      }),
    [runMutation, scopeVersion, processId],
  )

  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [canManage, setCanManage] = React.useState(false)
  const [process, setProcess] = React.useState<ProcessDetail | null>(null)
  const [statusAdvance, setStatusAdvance] = React.useState<StatusAdvanceTargets>({ enforced: false, items: [] })

  const [customerLabel, setCustomerLabel] = React.useState('')
  const [quoteLabel, setQuoteLabel] = React.useState('')
  const [resourceLabel, setResourceLabel] = React.useState('')

  const [suppliers, setSuppliers] = React.useState<SupplierRow[]>([])
  const [lines, setLines] = React.useState<LineRow[]>([])
  const [tasks, setTasks] = React.useState<TaskRow[]>([])
  const [timeline, setTimeline] = React.useState<TimelineRow[]>([])

  const initialDetailTab = React.useMemo((): DetailTabId => {
    const raw = searchParams.get('tab')
    if (
      raw === 'specification' ||
      raw === 'suppliers' ||
      raw === 'tasks' ||
      raw === 'history'
    ) {
      return raw
    }
    return 'details'
  }, [searchParams])
  const [activeTab, setActiveTab] = React.useState<DetailTabId>(initialDetailTab)
  React.useEffect(() => {
    setActiveTab(initialDetailTab)
  }, [initialDetailTab])

  const handleTabChange = React.useCallback(
    (id: DetailTabId) => {
      setActiveTab(id)
      const next = new URLSearchParams(searchParams.toString())
      if (id === 'details') next.delete('tab')
      else next.set('tab', id)
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const [lineDialog, setLineDialog] = React.useState<{ mode: 'create' } | { mode: 'edit'; row: LineRow } | null>(null)
  const [lineFormTitle, setLineFormTitle] = React.useState('')
  const [lineFormSpec, setLineFormSpec] = React.useState('')
  const [lineFormQuantity, setLineFormQuantity] = React.useState('')
  const [lineFormUnit, setLineFormUnit] = React.useState('')
  const [lineSaving, setLineSaving] = React.useState(false)

  const [supplierDialog, setSupplierDialog] = React.useState<{ mode: 'create' } | { mode: 'edit'; row: SupplierRow } | null>(
    null,
  )
  const [supplierFormNotes, setSupplierFormNotes] = React.useState('')
  const [supplierFormVendorEntityId, setSupplierFormVendorEntityId] = React.useState('')
  const [supplierCompanyPreview, setSupplierCompanyPreview] = React.useState<CustomerCompanySupplierPreview | null>(
    null,
  )
  const [supplierSaving, setSupplierSaving] = React.useState(false)

  const [taskDialog, setTaskDialog] = React.useState<{ mode: 'create' } | { mode: 'edit'; row: TaskRow } | null>(null)
  const [taskFormTitle, setTaskFormTitle] = React.useState('')
  const [taskFormBody, setTaskFormBody] = React.useState('')
  const [taskFormDue, setTaskFormDue] = React.useState<Date | null>(null)
  const [taskFormStatus, setTaskFormStatus] = React.useState<'open' | 'done' | 'cancelled'>('open')
  const [taskFormAssignee, setTaskFormAssignee] = React.useState('')
  const [taskFormSupplierId, setTaskFormSupplierId] = React.useState('')
  const [taskFormAssigneeLabel, setTaskFormAssigneeLabel] = React.useState('')
  const [taskSaving, setTaskSaving] = React.useState(false)

  const [tasksSorting, setTasksSorting] = React.useState<SortingState>([{ id: 'dueAt', desc: false }])
  const [timelineSorting, setTimelineSorting] = React.useState<SortingState>([{ id: 'createdAt', desc: true }])

  const [timelineDialog, setTimelineDialog] = React.useState<
    { mode: 'create' } | { mode: 'edit'; row: TimelineRow } | null
  >(null)
  const [timelineFormMessage, setTimelineFormMessage] = React.useState('')
  const [timelineSaving, setTimelineSaving] = React.useState(false)

  const [completeResourceId, setCompleteResourceId] = React.useState('')
  const [completeInvoiceId, setCompleteInvoiceId] = React.useState('')
  const [completeResourceLabel, setCompleteResourceLabel] = React.useState('')

  const [completing, setCompleting] = React.useState(false)
  const [refinancingDialogOpen, setRefinancingDialogOpen] = React.useState(false)
  const [completeDialogOpen, setCompleteDialogOpen] = React.useState(false)
  const [rfResourceId, setRfResourceId] = React.useState('')
  const [rfSupplierId, setRfSupplierId] = React.useState('')
  const [rfInvoiceId, setRfInvoiceId] = React.useState('')
  const [rfNotes, setRfNotes] = React.useState('')
  const [rfResourceLabel, setRfResourceLabel] = React.useState('')
  const [rfSaving, setRfSaving] = React.useState(false)

  React.useEffect(() => {
    clearProcurementDictionaryIdCache()
  }, [scopeVersion])

  const [unitDictionaryOptions, setUnitDictionaryOptions] = React.useState<DictionaryOption[]>([])
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const rows = await fetchDictionaryOptionsByKey(CATALOG_UNIT_DICTIONARY_KEY)
      if (!cancelled) setUnitDictionaryOptions(rows)
    })()
    return () => {
      cancelled = true
    }
  }, [scopeVersion])

  const lineUnitDictionaryMap = React.useMemo(() => {
    const entries: DictionaryDisplayEntry[] = unitDictionaryOptions.map((o) => ({
      value: o.value,
      label: o.label,
      color: o.color ?? null,
      icon: o.icon ?? null,
    }))
    const seen = new Set(entries.map((e) => e.value))
    for (const line of lines) {
      const v = line.unitLabel?.trim()
      if (v && !seen.has(v)) {
        seen.add(v)
        entries.push({ value: v, label: v, color: null, icon: null })
      }
    }
    return createDictionaryMap(entries)
  }, [unitDictionaryOptions, lines])

  const unitSelectLabels = React.useMemo(() => procurementDictionarySelectLabels(t, 'unit'), [t])

  React.useEffect(() => {
    let cancelled = false
    async function loadPerm() {
      const call = await apiCall<{ granted?: string[]; ok?: boolean }>('/api/auth/feature-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ features: ['procurement.processes.manage'] }),
      })
      if (cancelled) return
      const granted = Array.isArray(call.result?.granted) ? call.result?.granted : []
      setCanManage(call.result?.ok === true || granted.includes('procurement.processes.manage'))
    }
    void loadPerm()
    return () => {
      cancelled = true
    }
  }, [])

  const reload = React.useCallback(async () => {
    if (!processId) return
    setLoading(true)
    setError(null)
    try {
      const [procRes, supRes, lineRes, taskRes, timeRes] = await Promise.all([
        apiCall<Paged<ProcessDetail>>(
          `/api/procurement/processes?id=${encodeURIComponent(processId)}&pageSize=1`,
        ),
        apiCall<Paged<SupplierRow>>(
          `/api/procurement/process-suppliers?processId=${encodeURIComponent(processId)}&pageSize=100&sortField=createdAt&sortDir=asc`,
        ),
        apiCall<Paged<LineRow>>(
          `/api/procurement/process-line-items?processId=${encodeURIComponent(processId)}&pageSize=100&sortField=createdAt&sortDir=asc`,
        ),
        apiCall<Paged<TaskRow>>(
          `/api/procurement/process-tasks?processId=${encodeURIComponent(processId)}&pageSize=100`,
        ),
        apiCall<Paged<TimelineRow>>(
          `/api/procurement/process-timeline?processId=${encodeURIComponent(processId)}&pageSize=100&sortDir=desc`,
        ),
      ])
      const row = procRes.result?.items?.[0]
      if (!procRes.ok || !row) {
        setProcess(null)
        setError(t('procurement.processes.detail.loadError', 'Failed to load process.'))
        return
      }
      setProcess(row)
      setSuppliers(
        (Array.isArray(supRes.result?.items) ? supRes.result.items : []).map((s) => {
          const row = s as SupplierRow & { vendorCustomerEntityId?: string | null }
          return {
            id: row.id,
            vendorCustomerEntityId:
              typeof row.vendorCustomerEntityId === 'string' ? row.vendorCustomerEntityId : null,
            vendorLabel: row.vendorLabel,
            contactName: row.contactName ?? null,
            email: row.email ?? null,
            phone: row.phone ?? null,
            website: row.website ?? null,
            notes: row.notes ?? null,
            offerSummary: row.offerSummary ?? null,
          }
        }),
      )
      setLines(
        (Array.isArray(lineRes.result?.items) ? lineRes.result.items : []).map((line) => ({
          id: line.id,
          title: line.title,
          specification: line.specification ?? null,
          quantity: typeof line.quantity === 'number' ? line.quantity : null,
          unitLabel: line.unitLabel ?? null,
        })),
      )
      setTasks(Array.isArray(taskRes.result?.items) ? taskRes.result.items : [])
      setTimeline(
        (Array.isArray(timeRes.result?.items) ? timeRes.result.items : []).map((ev) => ({
          ...(ev as TimelineRow),
          processId:
            typeof (ev as TimelineRow).processId === 'string' && (ev as TimelineRow).processId.length
              ? (ev as TimelineRow).processId
              : processId,
        })),
      )
    } finally {
      setLoading(false)
    }
  }, [processId, t])

  React.useEffect(() => {
    void reload()
  }, [reload, scopeVersion])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!processId || !process) {
        if (!cancelled) setStatusAdvance({ enforced: false, items: [] })
        return
      }
      const call = await apiCall<{
        enforced?: boolean
        items?: { toStatusValue: string; toStatusLabel: string; sortOrder: number }[]
      }>(`/api/procurement/process-status-transitions?processId=${encodeURIComponent(processId)}`)
      if (cancelled) return
      if (!call.ok) {
        setStatusAdvance({ enforced: false, items: [] })
        return
      }
      const raw = Array.isArray(call.result?.items) ? call.result.items : []
      const items = raw
        .map((r) => ({
          toStatusValue: String(r.toStatusValue ?? ''),
          toStatusLabel: String(r.toStatusLabel ?? r.toStatusValue ?? ''),
          sortOrder: typeof r.sortOrder === 'number' ? r.sortOrder : 0,
        }))
        .filter((r) => r.toStatusValue.length > 0)
        .sort((a, b) => a.sortOrder - b.sortOrder)
      setStatusAdvance({
        enforced: call.result?.enforced === true,
        items: items.map(({ toStatusValue, toStatusLabel }) => ({ toStatusValue, toStatusLabel })),
      })
    })()
    return () => {
      cancelled = true
    }
  }, [processId, process?.statusValue, scopeVersion])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const cid = process?.customerEntityId?.trim()
      if (!cid) {
        if (!cancelled) setCustomerLabel('')
        return
      }
      const label = await resolveCustomerEntityDisplayLabel(cid)
      if (!cancelled) setCustomerLabel(label ?? cid)
    })()
    return () => {
      cancelled = true
    }
  }, [process?.customerEntityId])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const qid = process?.salesQuoteId?.trim()
      if (!qid) {
        if (!cancelled) setQuoteLabel('')
        return
      }
      const label = await resolveQuoteDisplayLabel(qid)
      if (!cancelled) setQuoteLabel(label ?? qid)
    })()
    return () => {
      cancelled = true
    }
  }, [process?.salesQuoteId])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const rid = process?.resourceId?.trim()
      if (!rid) {
        if (!cancelled) setResourceLabel('')
        return
      }
      const label = await resolveResourceDisplayLabel(rid)
      if (!cancelled) setResourceLabel(label ?? rid)
    })()
    return () => {
      cancelled = true
    }
  }, [process?.resourceId])

  const isClosed = Boolean(process?.closedAt)
  const allowEdits = canManage && !isClosed

  const patchProcess = React.useCallback(
    async (patch: Record<string, unknown>) => {
      if (!processId || !allowEdits) return
      try {
        await withGuard('procurement.processes.update', () =>
          updateCrud(
            'procurement/processes',
            { id: processId, ...patch },
            { errorMessage: t('procurement.processes.detail.saveError', 'Failed to save.') },
          ),
        )
        flash(t('procurement.processes.detail.saved', 'Saved.'), 'success')
        await reload()
      } catch {
        flash(t('procurement.processes.detail.saveError', 'Failed to save.'), 'error')
      }
    },
    [processId, allowEdits, withGuard, t, reload],
  )

  const overviewFields: DetailFieldConfig[] = React.useMemo(() => {
    if (!process) return []
    const emptyLabel = t('procurement.processes.list.noValue', '—')
    return [
      {
        key: 'title',
        kind: 'text',
        label: t('procurement.processes.create.fields.title', 'Title'),
        value: process.title,
        placeholder: t('procurement.processes.create.fields.title', 'Title'),
        emptyLabel,
        gridClassName: 'md:col-span-2',
        showEditTrigger: allowEdits,
        activateOnClick: allowEdits,
        validator: (v) =>
          v.trim().length ? null : t('procurement.processes.form.titleRequired', 'Title is required.'),
        onSave: async (v) => {
          const next = (v ?? '').trim()
          await patchProcess({ title: next })
        },
      },
      {
        key: 'typeValue',
        kind: 'custom',
        label: '',
        emptyLabel,
        gridClassName: 'md:col-span-1',
        render: () => (
          <ProcurementDictionaryInline kind="type" process={process} allowEdits={allowEdits} patchProcess={patchProcess} />
        ),
      },
      {
        key: 'statusValue',
        kind: 'custom',
        label: '',
        emptyLabel,
        gridClassName: 'md:col-span-1',
        render: () => (
          <ProcurementDictionaryInline
            kind="status"
            process={process}
            allowEdits={allowEdits}
            patchProcess={patchProcess}
            statusAdvance={statusAdvance}
            onAdvanceStatus={(to) => void patchProcess({ statusValue: to })}
          />
        ),
      },
      {
        key: 'description',
        kind: 'multiline',
        label: t('procurement.processes.create.fields.description', 'Description'),
        value: process.description ?? null,
        placeholder: t('procurement.processes.create.fields.description', 'Description'),
        emptyLabel,
        gridClassName: 'md:col-span-2',
        showEditTrigger: allowEdits,
        activateOnClick: allowEdits,
        onSave: async (v) => {
          const raw = typeof v === 'string' ? v.trim() : ''
          await patchProcess({ description: raw.length ? raw : null })
        },
      },
    ]
  }, [process, allowEdits, patchProcess, t, statusAdvance])

  const supplierPickOptions = React.useMemo(() => {
    const base = suppliers.map((s) => ({ value: s.id, label: s.vendorLabel }))
    const sid = process?.selectedSupplierId ?? ''
    return mergeEntitySearchOption(
      base,
      sid,
      suppliers.find((s) => s.id === sid)?.vendorLabel ?? sid,
    )
  }, [suppliers, process?.selectedSupplierId])

  const taskSupplierOptions = React.useMemo(() => {
    const base = suppliers.map((s) => ({ value: s.id, label: s.vendorLabel }))
    return mergeEntitySearchOption(
      base,
      taskFormSupplierId,
      suppliers.find((s) => s.id === taskFormSupplierId)?.vendorLabel ?? taskFormSupplierId,
    )
  }, [suppliers, taskFormSupplierId])

  const rfSupplierOptions = React.useMemo(() => {
    const base = suppliers.map((s) => ({ value: s.id, label: s.vendorLabel }))
    return mergeEntitySearchOption(
      base,
      rfSupplierId,
      suppliers.find((s) => s.id === rfSupplierId)?.vendorLabel ?? rfSupplierId,
    )
  }, [suppliers, rfSupplierId])

  const invoiceUuidValidator = React.useCallback(
    (value: string) => {
      const s = value.trim()
      if (!s) return null
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
        ? null
        : t('procurement.processes.detail.inline.invoiceUuidInvalid', 'Enter a valid UUID or leave empty.')
    },
    [t],
  )

  React.useEffect(() => {
    if (!refinancingDialogOpen || !process) return
    setRfResourceId(process.resourceId ?? '')
    setRfSupplierId(process.selectedSupplierId ?? '')
    setRfInvoiceId(process.salesInvoiceId ?? '')
    setRfNotes(process.refinancingNotes ?? '')
  }, [
    refinancingDialogOpen,
    process?.id,
    process?.resourceId,
    process?.selectedSupplierId,
    process?.salesInvoiceId,
    process?.refinancingNotes,
  ])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const rid = rfResourceId.trim()
      if (!rid) {
        if (!cancelled) setRfResourceLabel('')
        return
      }
      const label = await resolveResourceDisplayLabel(rid)
      if (!cancelled) setRfResourceLabel(label ?? rid)
    })()
    return () => {
      cancelled = true
    }
  }, [rfResourceId])

  const submitRefinancing = React.useCallback(async () => {
    if (!processId || !allowEdits) return
    const rid = optionalUuid(rfResourceId)
    if (!rid) {
      flash(
        t('procurement.processes.detail.refinancing.resourceRequired', 'Select a linked resource.'),
        'error',
      )
      return
    }
    const invRaw = rfInvoiceId.trim()
    if (invRaw) {
      const invErr = invoiceUuidValidator(invRaw)
      if (invErr) {
        flash(invErr, 'error')
        return
      }
    }
    setRfSaving(true)
    try {
      await withGuard('procurement.processes.update', () =>
        updateCrud(
          'procurement/processes',
          {
            id: processId,
            refinancingEnabled: true,
            resourceId: rid,
            selectedSupplierId: optionalUuid(rfSupplierId),
            salesInvoiceId: invRaw.length ? invRaw : null,
            refinancingNotes: rfNotes.trim().length ? rfNotes.trim() : null,
          },
          { errorMessage: t('procurement.processes.detail.saveError', 'Failed to save.') },
        ),
      )
      flash(t('procurement.processes.detail.saved', 'Saved.'), 'success')
      setRefinancingDialogOpen(false)
      await reload()
    } catch {
      flash(t('procurement.processes.detail.saveError', 'Failed to save.'), 'error')
    } finally {
      setRfSaving(false)
    }
  }, [
    processId,
    allowEdits,
    rfResourceId,
    rfSupplierId,
    rfInvoiceId,
    rfNotes,
    invoiceUuidValidator,
    withGuard,
    t,
    reload,
  ])

  React.useEffect(() => {
    if (!lineDialog) return
    if (lineDialog.mode === 'create') {
      setLineFormTitle('')
      setLineFormSpec('')
      setLineFormQuantity('')
      setLineFormUnit('')
    } else {
      const row = lineDialog.row
      setLineFormTitle(row.title)
      setLineFormSpec(row.specification ?? '')
      setLineFormQuantity(row.quantity != null ? String(row.quantity) : '')
      setLineFormUnit(row.unitLabel ?? '')
    }
  }, [lineDialog])

  const fetchLineUnitDictionaryOptions = React.useCallback(async () => {
    const rows = await fetchDictionaryOptionsByKey(CATALOG_UNIT_DICTIONARY_KEY)
    const v = lineFormUnit.trim()
    if (!v) return rows
    if (rows.some((o) => o.value === v)) return rows
    return [...rows, { value: v, label: v, color: null, icon: null }]
  }, [lineFormUnit])

  React.useEffect(() => {
    if (!supplierDialog) return
    let cancelled = false
    if (supplierDialog.mode === 'create') {
      setSupplierFormNotes('')
      setSupplierFormVendorEntityId('')
      setSupplierCompanyPreview(null)
    } else {
      const row = supplierDialog.row
      setSupplierFormNotes(row.notes ?? '')
      const cid = row.vendorCustomerEntityId?.trim() ?? ''
      setSupplierFormVendorEntityId(cid)
      if (cid) {
        void fetchCustomerCompanySupplierPreview(cid).then((p) => {
          if (!cancelled) setSupplierCompanyPreview(p)
        })
      } else {
        setSupplierCompanyPreview(null)
      }
    }
    return () => {
      cancelled = true
    }
  }, [supplierDialog])

  React.useEffect(() => {
    if (!taskDialog) return
    if (taskDialog.mode === 'create') {
      setTaskFormTitle('')
      setTaskFormBody('')
      setTaskFormDue(null)
      setTaskFormStatus('open')
      setTaskFormAssignee('')
      setTaskFormSupplierId('')
      setTaskFormAssigneeLabel('')
    } else {
      const row = taskDialog.row
      setTaskFormTitle(row.title)
      setTaskFormBody(row.body ?? '')
      if (row.dueAt) {
        const d = new Date(row.dueAt)
        setTaskFormDue(Number.isNaN(d.getTime()) ? null : d)
      } else {
        setTaskFormDue(null)
      }
      setTaskFormStatus(row.taskStatus as 'open' | 'done' | 'cancelled')
      setTaskFormAssignee(row.assignedUserId ?? '')
      setTaskFormSupplierId(row.supplierId ?? '')
    }
  }, [taskDialog])

  const submitLineDialog = React.useCallback(async () => {
    if (!processId || !allowEdits || !lineDialog) return
    const title = lineFormTitle.trim()
    if (!title) {
      flash(t('procurement.processes.detail.lines.nameRequired', 'Name is required.'), 'error')
      return
    }
    const specRaw = lineFormSpec.trim()
    const qRaw = lineFormQuantity.trim()
    let quantity: number | null = null
    if (qRaw) {
      const n = Number(qRaw)
      if (Number.isNaN(n) || n <= 0) {
        flash(
          t('procurement.processes.detail.crud.invalidPositiveNumber', 'Enter a positive number or leave empty.'),
          'error',
        )
        return
      }
      quantity = n
    }
    const payload: Record<string, unknown> = {
      title,
      specification: specRaw.length ? specRaw : null,
      quantity,
      unitLabel: lineFormUnit.trim() || null,
    }
    setLineSaving(true)
    try {
      if (lineDialog.mode === 'create') {
        await withGuard('procurement.process_line_items.create', () =>
          createCrud(
            'procurement/process-line-items',
            { processId, ...payload },
            { errorMessage: t('procurement.processes.detail.lines.createError', 'Failed to add line item.') },
          ),
        )
      } else {
        await withGuard('procurement.process_line_items.update', () =>
          updateCrud(
            'procurement/process-line-items',
            { id: lineDialog.row.id, ...payload },
            { errorMessage: t('procurement.processes.detail.lines.updateError', 'Failed to update line item.') },
          ),
        )
      }
      flash(t('procurement.processes.detail.saved', 'Saved.'), 'success')
      setLineDialog(null)
      await reload()
    } catch {
      flash(
        lineDialog.mode === 'create'
          ? t('procurement.processes.detail.lines.createError', 'Failed to add line item.')
          : t('procurement.processes.detail.lines.updateError', 'Failed to update line item.'),
        'error',
      )
    } finally {
      setLineSaving(false)
    }
  }, [
    processId,
    allowEdits,
    lineDialog,
    lineFormTitle,
    lineFormSpec,
    lineFormQuantity,
    lineFormUnit,
    withGuard,
    t,
    reload,
  ])

  const supplierEntityPickOptions = React.useMemo(() => {
    const v = supplierFormVendorEntityId.trim()
    if (!v) return []
    const label =
      supplierCompanyPreview?.entityId === v
        ? supplierCompanyPreview.vendorLabel
        : supplierDialog?.mode === 'edit' && supplierDialog.row.vendorCustomerEntityId === v
          ? supplierDialog.row.vendorLabel
          : v
    return mergeEntitySearchOption([], v, label)
  }, [supplierFormVendorEntityId, supplierCompanyPreview, supplierDialog])

  const onSupplierVendorEntityChange = React.useCallback(
    async (next: string) => {
      const v = next.trim()
      setSupplierFormVendorEntityId(v)
      if (!v) {
        setSupplierCompanyPreview(null)
        return
      }
      const p = await fetchCustomerCompanySupplierPreview(v)
      if (!p) {
        flash(
          t('procurement.processes.detail.suppliers.companyLoadError', 'Could not load company details.'),
          'error',
        )
        setSupplierCompanyPreview(null)
        return
      }
      setSupplierCompanyPreview(p)
    },
    [t],
  )

  const submitSupplierDialog = React.useCallback(async () => {
    if (!processId || !allowEdits || !supplierDialog) return
    const entityId = supplierFormVendorEntityId.trim()
    const preview = supplierCompanyPreview
    if (!entityId || !preview || preview.entityId !== entityId) {
      flash(
        t('procurement.processes.detail.suppliers.companyRequired', 'Choose a CRM company.'),
        'error',
      )
      return
    }
    const payload: Record<string, unknown> = {
      vendorLabel: preview.vendorLabel,
      vendorCustomerEntityId: entityId,
      contactName: preview.contactName,
      email: preview.email,
      phone: preview.phone,
      website: preview.website,
      notes: supplierFormNotes.trim() || null,
      offerSummary: null,
    }
    setSupplierSaving(true)
    try {
      if (supplierDialog.mode === 'create') {
        await withGuard('procurement.process_suppliers.create', () =>
          createCrud(
            'procurement/process-suppliers',
            { processId, ...payload },
            { errorMessage: t('procurement.processes.detail.suppliers.createError', 'Failed to add supplier.') },
          ),
        )
      } else {
        await withGuard('procurement.process_suppliers.update', () =>
          updateCrud(
            'procurement/process-suppliers',
            { id: supplierDialog.row.id, ...payload },
            { errorMessage: t('procurement.processes.detail.suppliers.updateError', 'Failed to update supplier.') },
          ),
        )
      }
      flash(t('procurement.processes.detail.saved', 'Saved.'), 'success')
      setSupplierDialog(null)
      await reload()
    } catch {
      flash(
        supplierDialog.mode === 'create'
          ? t('procurement.processes.detail.suppliers.createError', 'Failed to add supplier.')
          : t('procurement.processes.detail.suppliers.updateError', 'Failed to update supplier.'),
        'error',
      )
    } finally {
      setSupplierSaving(false)
    }
  }, [
    processId,
    allowEdits,
    supplierDialog,
    supplierFormNotes,
    supplierFormVendorEntityId,
    supplierCompanyPreview,
    withGuard,
    t,
    reload,
  ])

  const submitTaskDialog = React.useCallback(async () => {
    if (!processId || !allowEdits || !taskDialog) return
    const title = taskFormTitle.trim()
    if (!title) {
      flash(t('procurement.processes.detail.tasks.nameRequired', 'Name is required.'), 'error')
      return
    }
    let dueAt: Date | null | undefined
    if (taskFormDue) {
      const d = new Date(taskFormDue.getTime())
      if (Number.isNaN(d.getTime())) {
        flash(t('procurement.processes.detail.tasks.dueInvalid', 'Enter a valid date/time or leave empty.'), 'error')
        return
      }
      dueAt = d
    } else {
      dueAt = null
    }
    const payload: Record<string, unknown> = {
      title,
      body: taskFormBody.trim() || null,
      taskStatus: taskFormStatus,
      dueAt,
      assignedUserId: optionalUuid(taskFormAssignee),
      supplierId: optionalUuid(taskFormSupplierId),
    }
    setTaskSaving(true)
    try {
      if (taskDialog.mode === 'create') {
        await withGuard('procurement.process_tasks.create', () =>
          createCrud('procurement/process-tasks', { processId, ...payload }, {
            errorMessage: t('procurement.processes.detail.tasks.createError', 'Failed to add task.'),
          }),
        )
      } else {
        await withGuard('procurement.process_tasks.update', () =>
          updateCrud(
            'procurement/process-tasks',
            { id: taskDialog.row.id, ...payload },
            { errorMessage: t('procurement.processes.detail.tasks.updateError', 'Failed to update task.') },
          ),
        )
      }
      flash(t('procurement.processes.detail.saved', 'Saved.'), 'success')
      setTaskDialog(null)
      await reload()
    } catch {
      flash(
        taskDialog.mode === 'create'
          ? t('procurement.processes.detail.tasks.createError', 'Failed to add task.')
          : t('procurement.processes.detail.tasks.updateError', 'Failed to update task.'),
        'error',
      )
    } finally {
      setTaskSaving(false)
    }
  }, [
    processId,
    allowEdits,
    taskDialog,
    taskFormTitle,
    taskFormBody,
    taskFormDue,
    taskFormStatus,
    taskFormAssignee,
    taskFormSupplierId,
    withGuard,
    t,
    reload,
  ])

  const deleteLine = React.useCallback(
    async (line: LineRow) => {
      if (!allowEdits) return
      const ok = await confirm({
        title: t('common.confirm', 'Confirm'),
        text: t('procurement.processes.detail.lines.deleteConfirm', 'Remove this line?'),
        variant: 'destructive',
      })
      if (!ok) return
      try {
        await withGuard('procurement.process_line_items.delete', () =>
          deleteCrud('procurement/process-line-items', line.id, {
            errorMessage: t('procurement.processes.detail.lines.deleteError', 'Failed to delete line item.'),
          }),
        )
        await reload()
      } catch {
        flash(t('procurement.processes.detail.lines.deleteError', 'Failed to delete line item.'), 'error')
      }
    },
    [allowEdits, confirm, withGuard, t, reload],
  )

  const deleteSupplier = React.useCallback(
    async (row: SupplierRow) => {
      if (!allowEdits) return
      const ok = await confirm({
        title: t('common.confirm', 'Confirm'),
        text: t('procurement.processes.detail.suppliers.deleteConfirm', 'Remove this supplier?'),
        variant: 'destructive',
      })
      if (!ok) return
      try {
        await withGuard('procurement.process_suppliers.delete', () =>
          deleteCrud('procurement/process-suppliers', row.id, {
            errorMessage: t('procurement.processes.detail.suppliers.deleteError', 'Failed to delete supplier.'),
          }),
        )
        await reload()
      } catch {
        flash(t('procurement.processes.detail.suppliers.deleteError', 'Failed to delete supplier.'), 'error')
      }
    },
    [allowEdits, confirm, withGuard, t, reload],
  )

  const deleteTask = React.useCallback(
    async (task: TaskRow) => {
      if (!allowEdits) return
      const ok = await confirm({
        title: t('common.confirm', 'Confirm'),
        text: t('procurement.processes.detail.tasks.deleteConfirm', 'Remove this task?'),
        variant: 'destructive',
      })
      if (!ok) return
      try {
        await withGuard('procurement.process_tasks.delete', () =>
          deleteCrud('procurement/process-tasks', task.id, {
            errorMessage: t('procurement.processes.detail.tasks.deleteError', 'Failed to delete task.'),
          }),
        )
        await reload()
      } catch {
        flash(t('procurement.processes.detail.tasks.deleteError', 'Failed to delete task.'), 'error')
      }
    },
    [allowEdits, confirm, withGuard, t, reload],
  )

  const markTaskDone = React.useCallback(
    async (task: TaskRow) => {
      if (!allowEdits) return
      try {
        await withGuard('procurement.process_tasks.update', () =>
          updateCrud(
            'procurement/process-tasks',
            { id: task.id, taskStatus: 'done' },
            {
              errorMessage: t('procurement.processes.detail.tasks.updateError', 'Failed to update task.'),
            },
          ),
        )
        await reload()
      } catch {
        flash(t('procurement.processes.detail.tasks.updateError', 'Failed to update task.'), 'error')
      }
    },
    [allowEdits, withGuard, t, reload],
  )

  const lineColumns = React.useMemo<ColumnDef<LineRow>[]>(
    () => [
      {
        accessorKey: 'title',
        header: t('procurement.processes.detail.lines.title', 'Name'),
        meta: { priority: 1, sticky: true },
      },
      {
        accessorKey: 'specification',
        header: t('procurement.processes.detail.lines.spec', 'Description'),
        cell: ({ row }) => row.original.specification ?? '—',
        meta: { priority: 2 },
      },
      {
        accessorKey: 'quantity',
        header: t('procurement.processes.detail.lines.quantity', 'Quantity'),
        cell: ({ row }) => (row.original.quantity != null ? String(row.original.quantity) : '—'),
        meta: { priority: 3 },
      },
      {
        accessorKey: 'unitLabel',
        header: t('procurement.processes.detail.lines.unit', 'Unit'),
        cell: ({ row }) => {
          const v = row.original.unitLabel?.trim()
          if (!v) return '—'
          return (
            <DictionaryValue
              value={v}
              map={lineUnitDictionaryMap}
              fallback={<span className="text-sm">{v}</span>}
              className="text-sm"
              iconWrapperClassName="inline-flex h-6 w-6 items-center justify-center rounded border border-border bg-card"
              iconClassName="h-4 w-4"
              colorClassName="h-3 w-3 rounded-full"
            />
          )
        },
        meta: { priority: 4 },
      },
    ],
    [t, lineUnitDictionaryMap],
  )

  const supplierColumns = React.useMemo<ColumnDef<SupplierRow>[]>(
    () => [
      {
        accessorKey: 'vendorLabel',
        header: t('procurement.processes.detail.suppliers.vendorLabel', 'Vendor name'),
        meta: { priority: 1, sticky: true },
      },
      {
        accessorKey: 'contactName',
        header: t('procurement.processes.detail.suppliers.contact', 'Contact'),
        cell: ({ row }) => row.original.contactName ?? '—',
        meta: { priority: 2 },
      },
      {
        accessorKey: 'email',
        header: t('procurement.processes.detail.suppliers.email', 'Email'),
        cell: ({ row }) => row.original.email ?? '—',
        meta: { priority: 3 },
      },
      {
        accessorKey: 'phone',
        header: t('procurement.processes.detail.suppliers.phone', 'Phone'),
        cell: ({ row }) => row.original.phone ?? '—',
        meta: { priority: 4 },
      },
    ],
    [t],
  )

  const taskColumns = React.useMemo<ColumnDef<TaskRow>[]>(
    () => [
      {
        accessorKey: 'title',
        header: t('procurement.processes.detail.tasks.title', 'Title'),
        meta: { priority: 1, sticky: true },
      },
      {
        accessorKey: 'taskStatus',
        header: t('procurement.processes.detail.tasks.status', 'Status'),
        meta: { priority: 2 },
      },
      {
        accessorKey: 'dueAt',
        header: t('procurement.processes.detail.tasks.due', 'Due (ISO date)'),
        cell: ({ row }) =>
          row.original.dueAt ? new Date(row.original.dueAt).toLocaleString() : '—',
        meta: { priority: 3 },
      },
      {
        accessorKey: 'supplierId',
        header: t('procurement.processes.detail.tasks.supplier', 'Supplier'),
        cell: ({ row }) =>
          row.original.supplierId
            ? suppliers.find((s) => s.id === row.original.supplierId)?.vendorLabel ?? row.original.supplierId
            : '—',
        meta: { priority: 4 },
      },
    ],
    [t, suppliers],
  )

  React.useEffect(() => {
    if (!timelineDialog) return
    if (timelineDialog.mode === 'create') {
      setTimelineFormMessage('')
    } else {
      setTimelineFormMessage(timelineDialog.row.message)
    }
  }, [timelineDialog])

  const timelineColumns = React.useMemo<ColumnDef<TimelineRow>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: t('procurement.processes.detail.timeline.column.when', 'When'),
        cell: ({ row }) =>
          row.original.createdAt ? new Date(row.original.createdAt).toLocaleString() : '—',
        meta: { priority: 1 },
      },
      {
        accessorKey: 'eventType',
        header: t('procurement.processes.detail.timeline.column.type', 'Type'),
        meta: { priority: 2 },
      },
      {
        accessorKey: 'message',
        header: t('procurement.processes.detail.timeline.column.message', 'Message'),
        cell: ({ row }) => <span className="whitespace-pre-wrap">{row.original.message}</span>,
        meta: { priority: 3 },
      },
    ],
    [t],
  )

  const submitTimelineCreate = React.useCallback(async () => {
    if (!processId || !allowEdits) return
    const msg = timelineFormMessage.trim()
    if (!msg) {
      flash(
        t('procurement.processes.detail.timeline.messageRequired', 'Enter a message.'),
        'error',
      )
      return
    }
    setTimelineSaving(true)
    try {
      await withGuard('procurement.timeline.append', async () => {
        const call = await apiCall<{ ok?: boolean }>(`/api/procurement/process-timeline`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            processId,
            eventType: 'note',
            message: msg,
          }),
        })
        if (!call.ok) {
          throw new Error(t('procurement.processes.detail.timeline.error', 'Failed to add note.'))
        }
        return call
      })
      flash(t('procurement.processes.detail.saved', 'Saved.'), 'success')
      setTimelineDialog(null)
      await reload()
    } catch {
      flash(t('procurement.processes.detail.timeline.error', 'Failed to add note.'), 'error')
    } finally {
      setTimelineSaving(false)
    }
  }, [processId, allowEdits, timelineFormMessage, t, reload, withGuard])

  const submitTimelineEdit = React.useCallback(async () => {
    if (!processId || !allowEdits || !timelineDialog || timelineDialog.mode !== 'edit') return
    const msg = timelineFormMessage.trim()
    if (!msg) {
      flash(
        t('procurement.processes.detail.timeline.messageRequired', 'Enter a message.'),
        'error',
      )
      return
    }
    const row = timelineDialog.row
    setTimelineSaving(true)
    try {
      await withGuard('procurement.timeline.update', async () => {
        const call = await apiCall<{ ok?: boolean }>(`/api/procurement/process-timeline`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            id: row.id,
            processId: row.processId,
            message: msg,
          }),
        })
        if (!call.ok) {
          throw new Error(t('procurement.processes.detail.timeline.updateError', 'Failed to update note.'))
        }
        return call
      })
      flash(t('procurement.processes.detail.saved', 'Saved.'), 'success')
      setTimelineDialog(null)
      await reload()
    } catch {
      flash(t('procurement.processes.detail.timeline.updateError', 'Failed to update note.'), 'error')
    } finally {
      setTimelineSaving(false)
    }
  }, [processId, allowEdits, timelineDialog, timelineFormMessage, t, reload, withGuard])

  const deleteTimelineNoteRow = React.useCallback(
    async (row: TimelineRow) => {
      if (!processId || !allowEdits || row.eventType !== 'note') return
      const ok = await confirm({
        title: t('common.confirm', 'Confirm'),
        text: t('procurement.processes.detail.timeline.deleteConfirm', 'Remove this note?'),
        variant: 'destructive',
      })
      if (!ok) return
      try {
        await withGuard('procurement.timeline.delete', async () => {
          const call = await apiCall<{ ok?: boolean }>(
            `/api/procurement/process-timeline?id=${encodeURIComponent(row.id)}&processId=${encodeURIComponent(row.processId)}`,
            { method: 'DELETE' },
          )
          if (!call.ok) {
            throw new Error(t('procurement.processes.detail.timeline.deleteError', 'Failed to delete note.'))
          }
          return call
        })
        await reload()
      } catch {
        flash(t('procurement.processes.detail.timeline.deleteError', 'Failed to delete note.'), 'error')
      }
    },
    [processId, allowEdits, confirm, withGuard, t, reload],
  )

  const onComplete = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!processId || !allowEdits) return
      const rid = completeResourceId.trim()
      if (!rid) return
      const invRaw = completeInvoiceId.trim()
      if (invRaw) {
        const invErr = invoiceUuidValidator(invRaw)
        if (invErr) {
          flash(invErr, 'error')
          return
        }
      }
      setCompleting(true)
      try {
        await withGuard('procurement.processes.complete', async () => {
          const call = await apiCall<{ ok?: boolean }>(`/api/procurement/processes/complete`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              id: processId,
              resourceId: rid,
              salesInvoiceId: optionalUuid(completeInvoiceId),
            }),
          })
          if (!call.ok) {
            throw new Error(t('procurement.processes.detail.complete.error', 'Failed to complete process.'))
          }
          return call
        })
        flash(t('procurement.processes.detail.complete.success', 'Process completed.'), 'success')
        setCompleteResourceId('')
        setCompleteInvoiceId('')
        setCompleteResourceLabel('')
        setCompleteDialogOpen(false)
        await reload()
      } catch {
        flash(t('procurement.processes.detail.complete.error', 'Failed to complete process.'), 'error')
      } finally {
        setCompleting(false)
      }
    },
    [processId, allowEdits, completeResourceId, completeInvoiceId, invoiceUuidValidator, t, reload, withGuard],
  )

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const rid = taskFormAssignee.trim()
      if (!rid) {
        if (!cancelled) setTaskFormAssigneeLabel('')
        return
      }
      const label = await resolveUserDisplayLabel(rid)
      if (!cancelled) setTaskFormAssigneeLabel(label ?? rid)
    })()
    return () => {
      cancelled = true
    }
  }, [taskFormAssignee])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const rid = completeResourceId.trim()
      if (!rid) {
        if (!cancelled) setCompleteResourceLabel('')
        return
      }
      const label = await resolveResourceDisplayLabel(rid)
      if (!cancelled) setCompleteResourceLabel(label ?? rid)
    })()
    return () => {
      cancelled = true
    }
  }, [completeResourceId])

  if (!processId) {
    return (
      <Page>
        <PageBody>
          <ErrorMessage label={t('procurement.processes.detail.loadError', 'Failed to load process.')} />
        </PageBody>
      </Page>
    )
  }

  if (loading && !process) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('procurement.processes.detail.loading', 'Loading…')} />
        </PageBody>
      </Page>
    )
  }

  if (error || !process) {
    return (
      <Page>
        <PageBody className="space-y-4">
          <ErrorMessage label={error ?? t('procurement.processes.detail.loadError', 'Failed to load process.')} />
          <Button variant="outline" type="button" asChild>
            <Link href="/backend/procurement/processes">{t('procurement.processes.detail.back', 'Processes')}</Link>
          </Button>
        </PageBody>
      </Page>
    )
  }

  const resourceHref = process.resourceId
    ? `/backend/resources/resources/${encodeURIComponent(process.resourceId)}`
    : null

  return (
    <Page>
      <PageBody className="space-y-6">
        {ConfirmDialogElement}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1 text-sm text-muted-foreground">
              <Link href="/backend/procurement/processes" className="hover:underline">
                {t('procurement.processes.detail.back', 'Processes')}
              </Link>
            </div>
            <h1 className="text-xl font-semibold">{process.title}</h1>
            {isClosed ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {t('procurement.processes.detail.closed', 'Closed')}
                {process.closedAt ? ` ${new Date(process.closedAt).toLocaleString()}` : ''}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {allowEdits ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setRefinancingDialogOpen(true)}>
                {process.refinancingEnabled
                  ? t('procurement.processes.detail.header.editRefinancing', 'Edit refinancing')
                  : t('procurement.processes.detail.header.refinancing', 'Refinancing')}
              </Button>
            ) : null}
            {allowEdits ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setCompleteDialogOpen(true)}>
                {t('procurement.processes.detail.header.completeProcess', 'Complete process')}
              </Button>
            ) : null}
            {resourceHref ? (
              <Button type="button" variant="outline" size="sm" asChild>
                <Link
                  href={resourceHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  <ExternalLink className="size-4 shrink-0" aria-hidden />
                  {t('common.open', 'Open')}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[7fr_3fr] lg:items-start">
          <div className="min-w-0">
            <DetailTabsLayout<DetailTabId>
              tabs={[
                { id: 'details', label: t('procurement.processes.detail.tabs.details', 'Details') },
                {
                  id: 'specification',
                  label: t('procurement.processes.detail.tabs.specification', 'Specification'),
                },
                { id: 'suppliers', label: t('procurement.processes.detail.tabs.suppliers', 'Suppliers') },
                { id: 'tasks', label: t('procurement.processes.detail.tabs.tasks', 'Tasks') },
                { id: 'history', label: t('procurement.processes.detail.tabs.history', 'History') },
              ]}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              sectionAction={null}
              onSectionAction={() => {}}
              navAriaLabel={t('procurement.processes.detail.tabs.nav', 'Process sections')}
              panelContentKey={activeTab}
            >
              {activeTab === 'details' ? (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold">
                      {t('procurement.processes.detail.section.overview', 'Overview')}
                    </h2>
                    <DetailFieldsSection fields={overviewFields} className="md:grid-cols-2" />
                  </div>
                  {process.refinancingEnabled ? (
                    <div className="rounded-lg border bg-card px-4 py-3">
                      <h2 className="text-sm font-semibold">
                        {t('procurement.processes.detail.section.refinancing', 'Refinancing')}
                      </h2>
                      <div className="mt-3 space-y-4">
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">
                            {t('procurement.processes.detail.refinancing.resource', 'Linked resource')}
                          </div>
                          {process.resourceId ? (
                            <div className="relative mt-1 rounded-md border p-3 pe-28">
                              <div className="text-sm font-medium">
                                {resourceLabel || process.resourceId}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="absolute end-3 top-3 z-10 shrink-0"
                                asChild
                              >
                                <Link
                                  href={`/backend/resources/resources/${encodeURIComponent(process.resourceId)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2"
                                >
                                  <ExternalLink className="size-4 shrink-0" aria-hidden />
                                  {t('common.open', 'Open')}
                                </Link>
                              </Button>
                            </div>
                          ) : (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {t('procurement.processes.list.noValue', '—')}
                            </p>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">
                            {t('procurement.processes.detail.refinancing.supplier', 'Supplier')}
                          </div>
                          <p className="mt-1 text-sm">
                            {process.selectedSupplierId
                              ? suppliers.find((s) => s.id === process.selectedSupplierId)?.vendorLabel ??
                                process.selectedSupplierId
                              : t('procurement.processes.list.noValue', '—')}
                          </p>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">
                            {t('procurement.processes.detail.refinancing.invoice', 'Sales invoice ID')}
                          </div>
                          <p className="mt-1 text-sm break-all">
                            {process.salesInvoiceId?.trim()
                              ? process.salesInvoiceId
                              : t('procurement.processes.list.noValue', '—')}
                          </p>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">
                            {t('procurement.processes.detail.refinancing.notes', 'Refinancing notes')}
                          </div>
                          <p className="mt-1 whitespace-pre-wrap text-sm">
                            {process.refinancingNotes?.trim()
                              ? process.refinancingNotes
                              : t('procurement.processes.list.noValue', '—')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                  {process.closedAt ? (
                    <div className="rounded-lg border bg-card px-4 py-3">
                      <h2 className="text-sm font-semibold">
                        {t('procurement.processes.detail.section.completion', 'Process completion')}
                      </h2>
                      <div className="mt-3 space-y-4">
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">
                            {t('procurement.processes.detail.complete.resource', 'Resource')}
                          </div>
                          {process.resourceId ? (
                            <div className="relative mt-1 rounded-md border p-3 pe-28">
                              <div className="text-sm font-medium">
                                {resourceLabel || process.resourceId}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="absolute end-3 top-3 z-10 shrink-0"
                                asChild
                              >
                                <Link
                                  href={`/backend/resources/resources/${encodeURIComponent(process.resourceId)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2"
                                >
                                  <ExternalLink className="size-4 shrink-0" aria-hidden />
                                  {t('common.open', 'Open')}
                                </Link>
                              </Button>
                            </div>
                          ) : (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {t('procurement.processes.list.noValue', '—')}
                            </p>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">
                            {t('procurement.processes.detail.complete.salesInvoiceId', 'Final invoice ID (optional)')}
                          </div>
                          <p className="mt-1 text-sm break-all">
                            {process.salesInvoiceId?.trim()
                              ? process.salesInvoiceId
                              : t('procurement.processes.list.noValue', '—')}
                          </p>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-muted-foreground">
                            {t('procurement.processes.detail.completion.closedAt', 'Closed at')}
                          </div>
                          <p className="mt-1 text-sm">
                            {new Date(process.closedAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {activeTab === 'specification' ? (
                <DataTable<LineRow>
                  title={t('procurement.processes.detail.section.lines', 'Specification')}
                  data={lines}
                  columns={lineColumns}
                  emptyState={
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {t('procurement.processes.detail.emptyList', 'Nothing here yet.')}
                    </p>
                  }
                  actions={
                    allowEdits ? (
                      <Button type="button" size="sm" onClick={() => setLineDialog({ mode: 'create' })}>
                        {t('procurement.processes.detail.lines.add', 'Add line item')}
                      </Button>
                    ) : undefined
                  }
                  refreshButton={{
                    label: t('procurement.processes.list.actions.refresh', 'Refresh'),
                    onRefresh: () => void reload(),
                    isRefreshing: loading,
                  }}
                  rowActions={(row) =>
                    allowEdits ? (
                      <RowActions
                        items={[
                          {
                            id: 'edit',
                            label: t('common.edit', 'Edit'),
                            onSelect: () => setLineDialog({ mode: 'edit', row }),
                          },
                          {
                            id: 'delete',
                            label: t('procurement.processes.detail.remove', 'Remove'),
                            destructive: true,
                            onSelect: () => void deleteLine(row),
                          },
                        ]}
                      />
                    ) : null
                  }
                  onRowClick={allowEdits ? (row) => setLineDialog({ mode: 'edit', row }) : undefined}
                />
              ) : null}
              {activeTab === 'suppliers' ? (
                <DataTable<SupplierRow>
                  title={t('procurement.processes.detail.section.suppliers', 'Suppliers')}
                  data={suppliers}
                  columns={supplierColumns}
                  emptyState={
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {t('procurement.processes.detail.emptyList', 'Nothing here yet.')}
                    </p>
                  }
                  actions={
                    allowEdits ? (
                      <Button type="button" size="sm" onClick={() => setSupplierDialog({ mode: 'create' })}>
                        {t('procurement.processes.detail.suppliers.add', 'Add supplier')}
                      </Button>
                    ) : undefined
                  }
                  refreshButton={{
                    label: t('procurement.processes.list.actions.refresh', 'Refresh'),
                    onRefresh: () => void reload(),
                    isRefreshing: loading,
                  }}
                  rowActions={(row) =>
                    allowEdits ? (
                      <RowActions
                        items={[
                          {
                            id: 'edit',
                            label: t('common.edit', 'Edit'),
                            onSelect: () => setSupplierDialog({ mode: 'edit', row }),
                          },
                          {
                            id: 'delete',
                            label: t('procurement.processes.detail.remove', 'Remove'),
                            destructive: true,
                            onSelect: () => void deleteSupplier(row),
                          },
                        ]}
                      />
                    ) : null
                  }
                  onRowClick={allowEdits ? (row) => setSupplierDialog({ mode: 'edit', row }) : undefined}
                />
              ) : null}
              {activeTab === 'tasks' ? (
                <DataTable<TaskRow>
                  title={t('procurement.processes.detail.section.tasks', 'Tasks')}
                  data={tasks}
                  columns={taskColumns}
                  sortable
                  sorting={tasksSorting}
                  onSortingChange={setTasksSorting}
                  emptyState={
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {t('procurement.processes.detail.emptyList', 'Nothing here yet.')}
                    </p>
                  }
                  actions={
                    allowEdits ? (
                      <Button type="button" size="sm" onClick={() => setTaskDialog({ mode: 'create' })}>
                        {t('procurement.processes.detail.tasks.add', 'Add task')}
                      </Button>
                    ) : undefined
                  }
                  refreshButton={{
                    label: t('procurement.processes.list.actions.refresh', 'Refresh'),
                    onRefresh: () => void reload(),
                    isRefreshing: loading,
                  }}
                  rowActions={(row) => {
                    if (!allowEdits) return null
                    const task = row
                    const items: { id: string; label: string; destructive?: boolean; onSelect?: () => void }[] = [
                      {
                        id: 'edit',
                        label: t('common.edit', 'Edit'),
                        onSelect: () => setTaskDialog({ mode: 'edit', row: task }),
                      },
                    ]
                    if (task.taskStatus === 'open') {
                      items.push({
                        id: 'done',
                        label: t('procurement.processes.detail.tasks.markDone', 'Mark done'),
                        onSelect: () => void markTaskDone(task),
                      })
                    }
                    items.push({
                      id: 'delete',
                      label: t('procurement.processes.detail.remove', 'Remove'),
                      destructive: true,
                      onSelect: () => void deleteTask(task),
                    })
                    return <RowActions items={items} />
                  }}
                  onRowClick={allowEdits ? (row) => setTaskDialog({ mode: 'edit', row }) : undefined}
                />
              ) : null}
              {activeTab === 'history' ? (
                <DataTable<TimelineRow>
                  title={t('procurement.processes.detail.section.history', 'History')}
                  data={timeline}
                  columns={timelineColumns}
                  sortable
                  sorting={timelineSorting}
                  onSortingChange={setTimelineSorting}
                  emptyState={
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      {t('procurement.processes.detail.emptyList', 'Nothing here yet.')}
                    </p>
                  }
                  actions={
                    allowEdits ? (
                      <Button type="button" size="sm" onClick={() => setTimelineDialog({ mode: 'create' })}>
                        {t('procurement.processes.detail.timeline.addNote', 'Add note')}
                      </Button>
                    ) : undefined
                  }
                  refreshButton={{
                    label: t('procurement.processes.list.actions.refresh', 'Refresh'),
                    onRefresh: () => void reload(),
                    isRefreshing: loading,
                  }}
                  rowActions={(row) => {
                    if (!allowEdits || row.eventType !== 'note') return null
                    return (
                      <RowActions
                        items={[
                          {
                            id: 'edit',
                            label: t('common.edit', 'Edit'),
                            onSelect: () => setTimelineDialog({ mode: 'edit', row }),
                          },
                          {
                            id: 'delete',
                            label: t('procurement.processes.detail.remove', 'Remove'),
                            destructive: true,
                            onSelect: () => void deleteTimelineNoteRow(row),
                          },
                        ]}
                      />
                    )
                  }}
                  onRowClick={
                    allowEdits
                      ? (row) => {
                          if (row.eventType === 'note') setTimelineDialog({ mode: 'edit', row })
                        }
                      : undefined
                  }
                />
              ) : null}
            </DetailTabsLayout>
          </div>

          <div className="min-w-0 space-y-4">
            <div className="rounded-lg border bg-card px-4 py-3">
              <h2 className="text-sm font-semibold">
                {t('procurement.processes.detail.section.relations', 'Relations')}
              </h2>
              <div className="mt-3 space-y-4">
                <div className="space-y-2">
                  <span className="block text-sm font-medium">
                    {t('procurement.processes.create.fields.customerEntity', 'Customer')}
                  </span>
                  <EntitySearchCombobox
                    value={process.customerEntityId ?? ''}
                    onChange={(next) => void patchProcess({ customerEntityId: optionalUuid(next) })}
                    options={mergeEntitySearchOption(
                      [],
                      process.customerEntityId ?? '',
                      customerLabel || process.customerEntityId || '',
                    )}
                    onRemoteSearch={async (q) => {
                      const rows = await remoteSearchCustomerEntities(q)
                      return mergeEntitySearchOption(
                        rows,
                        process.customerEntityId ?? '',
                        customerLabel || process.customerEntityId || '',
                      )
                    }}
                    placeholder={t('procurement.processes.create.fields.customerSearch', 'Search customers…')}
                    disabled={!allowEdits}
                    createInNewTabHref="/backend/customers/companies/create"
                    createInNewTabAriaLabel={t(
                      'procurement.processes.create.fields.customerAdd',
                      'Open customers in a new tab',
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <span className="block text-sm font-medium">
                    {t('procurement.processes.create.fields.salesQuote', 'Sales quote')}
                  </span>
                  <EntitySearchCombobox
                    value={process.salesQuoteId ?? ''}
                    onChange={(next) => void patchProcess({ salesQuoteId: optionalUuid(next) })}
                    options={mergeEntitySearchOption(
                      [],
                      process.salesQuoteId ?? '',
                      quoteLabel || process.salesQuoteId || '',
                    )}
                    onRemoteSearch={async (q) => {
                      const rows = await remoteSearchSalesQuotes(q)
                      return mergeEntitySearchOption(
                        rows,
                        process.salesQuoteId ?? '',
                        quoteLabel || process.salesQuoteId || '',
                      )
                    }}
                    placeholder={t('procurement.processes.create.fields.quoteSearch', 'Search quotes…')}
                    disabled={!allowEdits}
                    createInNewTabHref="/backend/sales/documents/create"
                    createInNewTabAriaLabel={t(
                      'procurement.processes.create.fields.quoteAdd',
                      'Create sales document in a new tab',
                    )}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-card px-4 py-3">
              <AttachmentsSection
                entityId={PROCUREMENT_PROCESS_ENTITY_TYPE}
                recordId={processId}
                title={t('procurement.processes.detail.section.files', 'Attachments')}
              />
            </div>
          </div>
        </div>

        <Dialog open={timelineDialog !== null} onOpenChange={(open) => !open && setTimelineDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {timelineDialog?.mode === 'edit'
                  ? t('procurement.processes.detail.timeline.dialogEdit', 'Edit note')
                  : t('procurement.processes.detail.timeline.dialogCreate', 'New note')}
              </DialogTitle>
            </DialogHeader>
            <div className="py-2">
              <label htmlFor="timeline-note-body" className="sr-only">
                {t('procurement.processes.detail.timeline.column.message', 'Message')}
              </label>
              <textarea
                id="timeline-note-body"
                className={CRUD_FORM_TEXTAREA_CLASS}
                value={timelineFormMessage}
                onChange={(e) => setTimelineFormMessage(e.target.value)}
                placeholder={t('procurement.processes.detail.timeline.placeholder', 'Describe what happened…')}
                rows={5}
                disabled={!allowEdits}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTimelineDialog(null)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                type="button"
                disabled={!allowEdits || timelineSaving}
                onClick={() =>
                  void (timelineDialog?.mode === 'edit' ? submitTimelineEdit() : submitTimelineCreate())
                }
              >
                {t('procurement.processes.form.submit', 'Save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={refinancingDialogOpen} onOpenChange={setRefinancingDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('procurement.processes.detail.section.refinancing', 'Refinancing')}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2">
                <span className="block text-sm font-medium">
                  {t('procurement.processes.detail.refinancing.resource', 'Linked resource')}
                </span>
                <EntitySearchCombobox
                  value={rfResourceId}
                  onChange={setRfResourceId}
                  options={mergeEntitySearchOption([], rfResourceId, rfResourceLabel || rfResourceId)}
                  onRemoteSearch={async (q) => {
                    const rows = await remoteSearchResources(q)
                    return mergeEntitySearchOption(rows, rfResourceId, rfResourceLabel || rfResourceId)
                  }}
                  placeholder={t('procurement.processes.detail.resourceSearch', 'Search resources…')}
                  disabled={!allowEdits}
                  createInNewTabHref="/backend/resources/resources/create"
                  createInNewTabAriaLabel={t(
                    'procurement.processes.detail.resourceAdd',
                    'Create resource in a new tab',
                  )}
                />
              </div>
              <div className="space-y-2">
                <span className="block text-sm font-medium">
                  {t('procurement.processes.detail.refinancing.supplier', 'Supplier')}
                </span>
                <EntitySearchCombobox
                  value={rfSupplierId}
                  onChange={setRfSupplierId}
                  options={rfSupplierOptions}
                  placeholder={t('procurement.processes.detail.supplierPick', 'Choose a supplier…')}
                  disabled={!allowEdits}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="rf-invoice" className="block text-sm font-medium">
                  {t('procurement.processes.detail.refinancing.invoice', 'Sales invoice ID')}
                </label>
                <input
                  id="rf-invoice"
                  className={CRUD_FORM_TEXT_INPUT_CLASS}
                  value={rfInvoiceId}
                  onChange={(e) => setRfInvoiceId(e.target.value)}
                  placeholder={t(
                    'procurement.processes.detail.refinancing.invoicePlaceholder',
                    'Optional invoice UUID',
                  )}
                  disabled={!allowEdits}
                />
                <p className="text-sm text-muted-foreground">
                  {t(
                    'procurement.processes.detail.salesInvoice.hint',
                    'Optional reference UUID when your deployment records invoices.',
                  )}
                </p>
              </div>
              <div className="space-y-2">
                <label htmlFor="rf-notes" className="block text-sm font-medium">
                  {t('procurement.processes.detail.refinancing.notes', 'Refinancing notes')}
                </label>
                <textarea
                  id="rf-notes"
                  className={CRUD_FORM_TEXTAREA_CLASS}
                  value={rfNotes}
                  onChange={(e) => setRfNotes(e.target.value)}
                  placeholder={t(
                    'procurement.processes.detail.refinancing.notesPlaceholder',
                    'Notes about refinancing…',
                  )}
                  rows={4}
                  disabled={!allowEdits}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRefinancingDialogOpen(false)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="button" disabled={!allowEdits || rfSaving} onClick={() => void submitRefinancing()}>
                {t('procurement.processes.form.submit', 'Save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('procurement.processes.detail.complete.title', 'Complete process')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={onComplete} className="grid gap-4 py-2">
              <div className="space-y-2">
                <span className="block text-sm font-medium">
                  {t('procurement.processes.detail.complete.resource', 'Resource')}
                </span>
                <EntitySearchCombobox
                  value={completeResourceId}
                  onChange={setCompleteResourceId}
                  options={mergeEntitySearchOption(
                    [],
                    completeResourceId,
                    completeResourceLabel || completeResourceId,
                  )}
                  onRemoteSearch={async (q) => {
                    const rows = await remoteSearchResources(q)
                    return mergeEntitySearchOption(
                      rows,
                      completeResourceId,
                      completeResourceLabel || completeResourceId,
                    )
                  }}
                  placeholder={t('procurement.processes.detail.resourceSearch', 'Search resources…')}
                  createInNewTabHref="/backend/resources/resources/create"
                  createInNewTabAriaLabel={t(
                    'procurement.processes.detail.resourceAdd',
                    'Create resource in a new tab',
                  )}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="complete-dialog-invoice" className="block text-sm font-medium">
                  {t('procurement.processes.detail.complete.salesInvoiceId', 'Final invoice ID (optional)')}
                </label>
                <input
                  id="complete-dialog-invoice"
                  className={CRUD_FORM_TEXT_INPUT_CLASS}
                  value={completeInvoiceId}
                  onChange={(e) => setCompleteInvoiceId(e.target.value)}
                />
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setCompleteDialogOpen(false)}>
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button type="submit" disabled={completing || !completeResourceId.trim()}>
                  {t('procurement.processes.detail.complete.submit', 'Complete and link resource')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={lineDialog !== null} onOpenChange={(open) => !open && setLineDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {lineDialog?.mode === 'edit'
                  ? t('procurement.processes.detail.lines.dialogEdit', 'Edit line item')
                  : t('procurement.processes.detail.lines.dialogCreate', 'New line item')}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium" htmlFor="line-d-title">
                  {t('procurement.processes.detail.lines.title', 'Name')}
                </label>
                <input
                  id="line-d-title"
                  className={CRUD_FORM_TEXT_INPUT_CLASS}
                  value={lineFormTitle}
                  onChange={(e) => setLineFormTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium" htmlFor="line-d-spec">
                  {t('procurement.processes.detail.lines.spec', 'Description')}
                </label>
                <textarea
                  id="line-d-spec"
                  className={CRUD_FORM_TEXTAREA_CLASS}
                  rows={3}
                  value={lineFormSpec}
                  onChange={(e) => setLineFormSpec(e.target.value)}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-medium" htmlFor="line-d-qty">
                    {t('procurement.processes.detail.lines.quantity', 'Quantity')}
                  </label>
                  <input
                    id="line-d-qty"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    value={lineFormQuantity}
                    onChange={(e) => setLineFormQuantity(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <span className="block text-sm font-medium" id="line-d-unit-label">
                    {t('procurement.processes.detail.lines.unit', 'Unit')}
                  </span>
                  <DictionaryEntrySelect
                    value={lineFormUnit.trim() ? lineFormUnit.trim() : undefined}
                    onChange={(next) => setLineFormUnit(next ?? '')}
                    fetchOptions={fetchLineUnitDictionaryOptions}
                    labels={unitSelectLabels}
                    manageHref={`/backend/config/dictionaries?key=${encodeURIComponent(CATALOG_UNIT_DICTIONARY_KEY)}`}
                    allowInlineCreate={false}
                    allowAppearance
                    selectClassName="w-full"
                    showLabelInput={false}
                    disabled={!allowEdits}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLineDialog(null)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="button" disabled={!allowEdits || lineSaving} onClick={() => void submitLineDialog()}>
                {t('procurement.processes.form.submit', 'Save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={supplierDialog !== null} onOpenChange={(open) => !open && setSupplierDialog(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {supplierDialog?.mode === 'edit'
                  ? t('procurement.processes.detail.suppliers.dialogEdit', 'Edit supplier')
                  : t('procurement.processes.detail.suppliers.dialogCreate', 'New supplier')}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-2">
                <span className="block text-sm font-medium">
                  {t('procurement.processes.detail.suppliers.customerCompany', 'Company')}
                </span>
                <EntitySearchCombobox
                  value={supplierFormVendorEntityId}
                  onChange={(next) => void onSupplierVendorEntityChange(next)}
                  options={supplierEntityPickOptions}
                  onRemoteSearch={remoteSearchCustomerCompanies}
                  placeholder={t(
                    'procurement.processes.detail.suppliers.customerCompanySearch',
                    'Search companies…',
                  )}
                  disabled={!allowEdits}
                  createInNewTabHref="/backend/customers/companies/create"
                  createInNewTabAriaLabel={t(
                    'procurement.processes.detail.suppliers.customerCompanyCreate',
                    'Open companies in a new tab',
                  )}
                />
              </div>
              {supplierCompanyPreview ? (
                <div className="relative rounded-lg border bg-muted/30 px-3 py-3 text-sm">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="absolute end-3 top-3 z-10 shrink-0"
                    asChild
                  >
                    <Link
                      href={`/backend/customers/companies-v2/${encodeURIComponent(supplierCompanyPreview.entityId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center"
                      aria-label={t('common.edit', 'Edit')}
                    >
                      <Pencil className="size-4 shrink-0" aria-hidden />
                    </Link>
                  </Button>
                  <div className="pe-28 pt-1">
                    <p className="font-medium text-foreground">
                      {t(
                        'procurement.processes.detail.suppliers.selectedPreviewTitle',
                        'Selected supplier',
                      )}
                    </p>
                    <dl className="mt-3 space-y-4">
                      <div>
                        <dt className="text-muted-foreground">
                          {t('procurement.processes.detail.suppliers.vendorLabel', 'Vendor name')}
                        </dt>
                        <dd className="mt-0.5 font-medium wrap-break-word">{supplierCompanyPreview.vendorLabel}</dd>
                      </div>
                      <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                        <div>
                          <dt className="text-muted-foreground">
                            {t('procurement.processes.detail.suppliers.contact', 'Contact')}
                          </dt>
                          <dd className="mt-0.5 wrap-break-word">{supplierCompanyPreview.contactName ?? '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">
                            {t('procurement.processes.detail.suppliers.email', 'Email')}
                          </dt>
                          <dd className="mt-0.5 wrap-break-word">{supplierCompanyPreview.email ?? '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">
                            {t('procurement.processes.detail.suppliers.phone', 'Phone')}
                          </dt>
                          <dd className="mt-0.5 wrap-break-word">{supplierCompanyPreview.phone ?? '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">
                            {t('procurement.processes.detail.suppliers.website', 'Website')}
                          </dt>
                          <dd className="mt-0.5 break-all">{supplierCompanyPreview.website ?? '—'}</dd>
                        </div>
                      </div>
                    </dl>
                  </div>
                </div>
              ) : null}
              <div className="space-y-2">
                <label className="block text-sm font-medium" htmlFor="sup-d-notes">
                  {t('procurement.processes.detail.suppliers.notes', 'Notes')}
                </label>
                <textarea
                  id="sup-d-notes"
                  className={CRUD_FORM_TEXTAREA_CLASS}
                  rows={2}
                  value={supplierFormNotes}
                  onChange={(e) => setSupplierFormNotes(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSupplierDialog(null)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                type="button"
                disabled={
                  !allowEdits ||
                  supplierSaving ||
                  !supplierFormVendorEntityId.trim() ||
                  !supplierCompanyPreview ||
                  supplierCompanyPreview.entityId !== supplierFormVendorEntityId.trim()
                }
                onClick={() => void submitSupplierDialog()}
              >
                {t('procurement.processes.form.submit', 'Save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={taskDialog !== null} onOpenChange={(open) => !open && setTaskDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {taskDialog?.mode === 'edit'
                  ? t('procurement.processes.detail.tasks.dialogEdit', 'Edit task')
                  : t('procurement.processes.detail.tasks.dialogCreate', 'New task')}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium" htmlFor="task-d-title">
                  {t('procurement.processes.detail.tasks.title', 'Name')}
                </label>
                <input
                  id="task-d-title"
                  className={CRUD_FORM_TEXT_INPUT_CLASS}
                  value={taskFormTitle}
                  onChange={(e) => setTaskFormTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium" htmlFor="task-d-body">
                  {t('procurement.processes.detail.tasks.body', 'Description')}
                </label>
                <textarea
                  id="task-d-body"
                  className={CRUD_FORM_TEXTAREA_CLASS}
                  rows={3}
                  value={taskFormBody}
                  onChange={(e) => setTaskFormBody(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <span className="block text-sm font-medium" id="task-d-due-label">
                  {t('procurement.processes.detail.tasks.due', 'Due date')}
                </span>
                <DateTimePicker
                  value={taskFormDue}
                  onChange={setTaskFormDue}
                  disabled={!allowEdits}
                  placeholder={t(
                    'procurement.processes.detail.tasks.duePlaceholder',
                    'Pick date and time',
                  )}
                />
              </div>
              <div className="space-y-2">
                <span className="block text-sm font-medium">
                  {t('procurement.processes.detail.tasks.supplier', 'Linked supplier')}
                </span>
                <EntitySearchCombobox
                  value={taskFormSupplierId}
                  onChange={setTaskFormSupplierId}
                  options={taskSupplierOptions}
                  placeholder={t(
                    'procurement.processes.detail.tasks.supplierSearch',
                    'Choose a linked supplier…',
                  )}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium" htmlFor="task-d-status">
                  {t('procurement.processes.detail.tasks.status', 'Status')}
                </label>
                <select
                  id="task-d-status"
                  className={CRUD_FORM_TEXT_INPUT_CLASS}
                  value={taskFormStatus}
                  onChange={(e) =>
                    setTaskFormStatus(e.target.value as 'open' | 'done' | 'cancelled')
                  }
                >
                  <option value="open">{t('procurement.processes.detail.tasks.statusOpen', 'Open')}</option>
                  <option value="done">{t('procurement.processes.detail.tasks.statusDone', 'Done')}</option>
                  <option value="cancelled">
                    {t('procurement.processes.detail.tasks.statusCancelled', 'Cancelled')}
                  </option>
                </select>
              </div>
              <div className="space-y-2">
                <span className="block text-sm font-medium">
                  {t('procurement.processes.detail.tasks.assigneeUser', 'Assignee')}
                </span>
                <EntitySearchCombobox
                  value={taskFormAssignee}
                  onChange={setTaskFormAssignee}
                  options={mergeEntitySearchOption(
                    [],
                    taskFormAssignee,
                    taskFormAssigneeLabel || taskFormAssignee,
                  )}
                  onRemoteSearch={async (q) => {
                    const rows = await remoteSearchAuthUsers(q)
                    return mergeEntitySearchOption(rows, taskFormAssignee, taskFormAssigneeLabel || taskFormAssignee)
                  }}
                  placeholder={t('procurement.processes.detail.tasks.userSearch', 'Search users…')}
                  createInNewTabHref="/backend/users/create"
                  createInNewTabAriaLabel={t('procurement.processes.detail.tasks.userAdd', 'Create user in a new tab')}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTaskDialog(null)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="button" disabled={!allowEdits || taskSaving} onClick={() => void submitTaskDialog()}>
                {t('procurement.processes.form.submit', 'Save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageBody>
    </Page>
  )
}
