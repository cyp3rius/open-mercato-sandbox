"use client"

import * as React from 'react'
import { z } from 'zod'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { CircleCheck, ExternalLink, Pencil, PlayCircle, Plus, UserPlus } from 'lucide-react'
import { Separator } from '@open-mercato/ui/primitives/separator'
import { ApplyBreadcrumb } from '@open-mercato/ui/backend/AppShell'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { FormHeader } from '@open-mercato/ui/backend/forms'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { CRUD_FORM_TEXT_INPUT_CLASS, CRUD_FORM_TEXTAREA_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import {
  InlineSelectEditor,
  InlineTextEditor,
  LoadingMessage,
} from '@open-mercato/ui/backend/detail'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { formatDateTime } from '@open-mercato/shared/lib/time'
import {
  fetchProcurementCustomerAssociationPreview,
  mergeEntitySearchOption,
  remoteSearchCustomerEntities,
  resolveCustomerEntityDisplayLabel,
  resolveResourceDisplayLabel,
  resolveUserDisplayLabel,
} from '../../../../procurement/lib/procurementEntitySearch'
import {
  remoteSearchInsurancePoliciesForCaseCustomer,
  remoteSearchPlaybooksForCase,
  remoteSearchProcurementProcessesForCaseCustomer,
  remoteSearchResourcesForCaseCustomer,
  resolveInsurancePolicyDisplayLabel,
  resolveProcurementProcessDisplayLabel,
} from '../../../lib/caseRelationsSearch'
import { formatProcedurePlaybookLabel } from '../../../lib/formatProcedurePlaybookLabel'
import { AttachmentsSection } from '@open-mercato/ui/backend/detail/AttachmentsSection'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { DetailTabsLayout } from '@open-mercato/core/modules/customers/components/detail/DetailTabsLayout'
import { E } from '#generated/entities.ids.generated'
import type { CaseProcedureBlockJson } from '../../../lib/procedureBlockJson'
import { CaseInterruptCloseDialog, type CaseInterruptOutcome } from '../../../components/CaseInterruptCloseDialog'
import { CaseProcedureStepExecutor } from '../../../components/CaseProcedureStepExecutor'
import { CaseStatusBadge } from '../../../components/CaseStatusBadge'

type InvokeProcedureOptionHead = {
  slug: string
  playbookId: string | null
  title: string | null
  version: number | null
}

type ProcedureTaskSummaryHead = {
  id: string
  title: string
  dueAt: string | null
  taskStatus: string
  userTaskId?: string | null
}

type CaseProcedureState = {
  playbookId: string | null
  playbookTitle: string | null
  playbookVersion?: number | null
  startedAt: string | null
  locked: boolean
  currentBlock: CaseProcedureBlockJson | null
  canSelectPlaybook: boolean
  canStart: boolean
  canNext: boolean
  canSendNotify: boolean
  canAnswerYesNo: boolean
  isOwner: boolean
  isVerifier: boolean
  invokeProcedureOptions?: InvokeProcedureOptionHead[]
  canLaunchInvokeProcedure?: boolean
  procedureTaskSummary?: ProcedureTaskSummaryHead | null
  canScheduleProcedureTask?: boolean
}

function procedureErrorMessage(err: string | null | undefined, t: (key: string, fallback: string) => string) {
  if (!err) return t('cases.detail.procedure.actionError', 'Could not update procedure.')
  if (err === 'Case not found.') return t('cases.errors.notFound', 'Case not found.')
  if (err.startsWith('cases.')) return t(err, err)
  return err
}

function truncateCaseBreadcrumbTitle(name: string, maxLen = 48): string {
  const s = name.trim()
  const base = s.length > 0 ? s : '—'
  if (base.length <= maxLen) return base
  return `${base.slice(0, maxLen)}…`
}

/** One-line block stays compact (~≤40px): actions vertically centered; wrapped titles align actions to the top-right. */
const RELATION_PREVIEW_TALL_HEIGHT_PX = 40

function CaseRelationPreviewDisplay({
  emptyLabel,
  valueId,
  resolvedLabel,
  openHref,
  requestEdit,
  translate,
}: {
  emptyLabel: string
  valueId: string
  resolvedLabel: string
  openHref: string | null
  requestEdit?: () => void
  translate: (key: string, fallback: string) => string
}) {
  const textMeasureRef = React.useRef<HTMLDivElement>(null)
  const [tallLayout, setTallLayout] = React.useState(false)
  const hasValue = Boolean(valueId.trim().length)
  const displayText = hasValue ? resolvedLabel.trim() || valueId.trim() : ''
  const hasCornerActions = Boolean(requestEdit || openHref)

  React.useLayoutEffect(() => {
    const el = textMeasureRef.current
    if (!el || !hasValue) return
    const update = () => {
      setTallLayout(el.getBoundingClientRect().height > RELATION_PREVIEW_TALL_HEIGHT_PX)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [displayText, hasValue])

  const actionButtons = hasCornerActions ? (
    <div className="pointer-events-none flex shrink-0 flex-row items-center justify-end gap-1 opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
      {requestEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            requestEdit()
          }}
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
      ) : null}
      {openHref ? (
        <Button type="button" variant="outline" size="sm" asChild className="shrink-0">
          <Link href={openHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2">
            <ExternalLink className="size-4 shrink-0" aria-hidden />
            {translate('common.open', 'Open')}
          </Link>
        </Button>
      ) : null}
    </div>
  ) : null

  if (!hasValue) {
    return (
      <div className="group relative flex min-h-10 items-center gap-2 text-sm">
        <span className={`min-w-0 flex-1 text-muted-foreground ${hasCornerActions ? 'pe-2' : ''}`}>{emptyLabel}</span>
        {actionButtons}
      </div>
    )
  }

  return (
    <div
      className={`group flex min-h-10 gap-2 text-sm ${tallLayout ? 'items-start' : 'items-center'}`}
    >
      <div ref={textMeasureRef} className="min-w-0 flex-1">
        <div className="wrap-break-word font-semibold leading-snug">{displayText}</div>
      </div>
      {actionButtons}
    </div>
  )
}

type CaseDetailTabId = 'details' | 'timeline' | 'messages'

type CaseMessageRow = {
  id: string
  subject: string
  sentAt: string | null
  recipientDisplay: string
  channelKind: 'email' | 'in_app'
}

type CaseDetail = {
  id: string
  title: string
  statusValue?: string
  customerEntityId?: string
  resourceId?: string | null
  procurementProcessId?: string | null
  insurancePolicyId?: string | null
  ownerUserId?: string | null
  openedAt?: string | null
  closedAt?: string | null
  metadata?: Record<string, unknown> | null
}

type TimelineRow = {
  id: string
  eventType: string
  body: string
  occurredAt: string
  actorUserId?: string | null
  actorLabel?: string | null
  sourceRef?: Record<string, unknown> | null
}

export default function CaseDetailPage({ params }: { params?: { id?: string } }) {
  const caseId = params?.id
  const t = useT()
  const { ConfirmDialogElement } = useConfirmDialog()
  const [tab, setTab] = React.useState<CaseDetailTabId>('details')
  const [loaded, setLoaded] = React.useState(false)
  const [caseRow, setCaseRow] = React.useState<CaseDetail | null>(null)
  const [timeline, setTimeline] = React.useState<TimelineRow[]>([])
  const [note, setNote] = React.useState('')
  const [messages, setMessages] = React.useState<CaseMessageRow[]>([])
  const [messagesLoading, setMessagesLoading] = React.useState(false)
  const [timelineLoading, setTimelineLoading] = React.useState(false)
  const [canEdit, setCanEdit] = React.useState(false)
  const [canPlaybooks, setCanPlaybooks] = React.useState(false)
  const [customerLabel, setCustomerLabel] = React.useState('')
  const [customerAssocPreview, setCustomerAssocPreview] = React.useState<
    Awaited<ReturnType<typeof fetchProcurementCustomerAssociationPreview>>
  >(null)
  const [canClose, setCanClose] = React.useState(false)
  const [canCloseInterruptProcedure, setCanCloseInterruptProcedure] = React.useState(false)
  const [canAssignProcedureOwner, setCanAssignProcedureOwner] = React.useState(false)
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null)
  const [resourceRelLabel, setResourceRelLabel] = React.useState('')
  const [processRelLabel, setProcessRelLabel] = React.useState('')
  const [policyRelLabel, setPolicyRelLabel] = React.useState('')
  const [procedure, setProcedure] = React.useState<CaseProcedureState | null>(null)
  const [procedureLoading, setProcedureLoading] = React.useState(false)
  const [procedureAction, setProcedureAction] = React.useState(false)
  const [closeCaseDialog, setCloseCaseDialog] = React.useState<{
    open: boolean
    variant: 'choice' | 'abortedOnly'
  }>({ open: false, variant: 'choice' })
  const [interruptClosing, setInterruptClosing] = React.useState(false)
  const [ownerDisplayLabel, setOwnerDisplayLabel] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    async function perm() {
      const call = await apiCall<{ granted?: string[]; ok?: boolean; userId?: string }>('/api/auth/feature-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          features: [
            'cases.edit',
            'playbooks.view',
            'cases.close',
            'cases.close.interruptProcedure',
            'cases.owner.assign',
          ],
        }),
      })
      if (cancelled) return
      const granted = Array.isArray(call.result?.granted) ? call.result.granted : []
      setCanEdit(call.result?.ok === true || granted.includes('cases.edit'))
      setCanPlaybooks(granted.includes('playbooks.view'))
      setCanClose(granted.includes('cases.close'))
      setCanCloseInterruptProcedure(granted.includes('cases.close.interruptProcedure'))
      setCanAssignProcedureOwner(granted.includes('cases.owner.assign'))
      const uid = typeof call.result?.userId === 'string' && call.result.userId.trim().length
        ? call.result.userId.trim()
        : null
      setCurrentUserId(uid)
    }
    void perm()
    return () => {
      cancelled = true
    }
  }, [])

  const loadCase = React.useCallback(async () => {
    if (!caseId) return
    const call = await apiCall<{ items?: CaseDetail[] }>(`/api/cases?ids=${encodeURIComponent(caseId)}&pageSize=1`)
    const row = Array.isArray(call.result?.items) ? call.result!.items[0] : null
    setCaseRow(row ?? null)
    setLoaded(true)
  }, [caseId])

  React.useEffect(() => {
    void loadCase()
  }, [loadCase])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const cid = caseRow?.customerEntityId?.trim()
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
  }, [caseRow?.customerEntityId])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const oid = caseRow?.ownerUserId?.trim()
      if (!oid) {
        if (!cancelled) setOwnerDisplayLabel('')
        return
      }
      const label = await resolveUserDisplayLabel(oid)
      if (!cancelled) setOwnerDisplayLabel(label ?? '')
    })()
    return () => {
      cancelled = true
    }
  }, [caseRow?.ownerUserId])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const cid = caseRow?.customerEntityId?.trim()
      if (!cid) {
        if (!cancelled) setCustomerAssocPreview(null)
        return
      }
      const preview = await fetchProcurementCustomerAssociationPreview(cid)
      if (!cancelled) setCustomerAssocPreview(preview)
    })()
    return () => {
      cancelled = true
    }
  }, [caseRow?.customerEntityId])

  React.useEffect(() => {
    let cancelled = false
    const rid = caseRow?.resourceId?.trim() ?? ''
    if (!rid.length) {
      setResourceRelLabel('')
      return
    }
    setResourceRelLabel('')
    void resolveResourceDisplayLabel(rid).then((label) => {
      if (!cancelled) setResourceRelLabel(label ?? rid)
    })
    return () => {
      cancelled = true
    }
  }, [caseRow?.resourceId])

  React.useEffect(() => {
    let cancelled = false
    const pid = caseRow?.procurementProcessId?.trim() ?? ''
    if (!pid.length) {
      setProcessRelLabel('')
      return
    }
    setProcessRelLabel('')
    void resolveProcurementProcessDisplayLabel(pid).then((label) => {
      if (!cancelled) setProcessRelLabel(label ?? pid)
    })
    return () => {
      cancelled = true
    }
  }, [caseRow?.procurementProcessId])

  React.useEffect(() => {
    let cancelled = false
    const iid = caseRow?.insurancePolicyId?.trim() ?? ''
    if (!iid.length) {
      setPolicyRelLabel('')
      return
    }
    setPolicyRelLabel('')
    void resolveInsurancePolicyDisplayLabel(iid).then((label) => {
      if (!cancelled) setPolicyRelLabel(label ?? iid)
    })
    return () => {
      cancelled = true
    }
  }, [caseRow?.insurancePolicyId])

  const loadTimeline = React.useCallback(async () => {
    if (!caseId) return
    setTimelineLoading(true)
    try {
      const call = await apiCall<{ items?: TimelineRow[] }>(
        `/api/cases/${encodeURIComponent(caseId)}/timeline`,
      ).catch(() => ({ ok: false as const }))
      if (!call.ok) {
        setTimeline([])
        return
      }
      setTimeline(Array.isArray(call.result?.items) ? call.result!.items! : [])
    } finally {
      setTimelineLoading(false)
    }
  }, [caseId])

  const loadProcedure = React.useCallback(async () => {
    if (!caseId) return
    setProcedureLoading(true)
    const call = await apiCall<CaseProcedureState>(`/api/cases/${encodeURIComponent(caseId)}/procedure`)
    setProcedureLoading(false)
    if (!call.ok || !call.result) {
      setProcedure(null)
      return
    }
    setProcedure(call.result)
  }, [caseId])

  const runProcedurePost = React.useCallback(
    async (body: Record<string, unknown>) => {
      if (!caseId || caseRow?.closedAt) return false
      setProcedureAction(true)
      const call = await apiCall<{ error?: string; caseClosed?: boolean }>(
        `/api/cases/${encodeURIComponent(caseId)}/procedure`,
        {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        },
      )
      setProcedureAction(false)
      if (!call.ok) {
        const rawErr =
          call.result && typeof call.result === 'object' && typeof (call.result as { error?: unknown }).error === 'string'
            ? (call.result as { error: string }).error
            : null
        flash(procedureErrorMessage(rawErr, t), 'error')
        return false
      }
      if (call.result?.caseClosed) {
        flash(
          t('cases.detail.procedure.finishedCaseClosed', 'Procedure completed. The case has been closed.'),
          'success',
        )
      } else {
        flash(t('cases.detail.procedure.actionOk', 'Updated.'), 'success')
      }
      await loadCase()
      await loadProcedure()
      void loadTimeline()
      return true
    },
    [caseId, caseRow?.closedAt, loadCase, loadProcedure, loadTimeline, t],
  )

  React.useEffect(() => {
    if (!caseId || !loaded || !caseRow) return
    void loadProcedure()
  }, [caseId, loaded, caseRow?.id, loadProcedure])

  React.useEffect(() => {
    if (tab === 'timeline') void loadTimeline()
  }, [loadTimeline, tab])

  const loadMessages = React.useCallback(async () => {
    if (!caseId) return
    setMessagesLoading(true)
    try {
      const call = await apiCall<{ items?: CaseMessageRow[] }>(
        `/api/cases/${encodeURIComponent(caseId)}/messages`,
      )
      if (!call.ok) {
        setMessages([])
        return
      }
      const raw = Array.isArray(call.result?.items) ? call.result!.items! : []
      setMessages(
        raw.map((m) => ({
          id: m.id,
          subject: typeof m.subject === 'string' ? m.subject : '',
          sentAt: m.sentAt ?? null,
          recipientDisplay: typeof (m as CaseMessageRow).recipientDisplay === 'string' ? (m as CaseMessageRow).recipientDisplay : '—',
          channelKind: (m as CaseMessageRow).channelKind === 'email' ? 'email' : 'in_app',
        })),
      )
    } finally {
      setMessagesLoading(false)
    }
  }, [caseId])

  React.useEffect(() => {
    if (tab === 'messages') void loadMessages()
  }, [loadMessages, tab])

  const caseTabs = React.useMemo(() => {
    const rows: Array<{ id: CaseDetailTabId; label: string }> = [
      { id: 'details', label: t('cases.detail.tabDetails', 'Details') },
      { id: 'timeline', label: t('cases.detail.tabTimeline', 'Timeline') },
      { id: 'messages', label: t('cases.detail.tabMessages', 'Messages') },
    ]
    return rows
  }, [t])

  const saveTitle = React.useCallback(
    async (next: string | null) => {
      if (!caseId || !canEdit || caseRow?.closedAt) return
      const v = next?.trim() ?? ''
      if (!v.length) {
        flash(t('cases.detail.titleRequired', 'Title is required.'), 'error')
        return
      }
      try {
        await updateCrud('cases', { id: caseId, title: v }, { errorMessage: t('cases.detail.saveError', 'Could not save.') })
        flash(t('cases.detail.saved', 'Saved.'), 'success')
        await loadCase()
      } catch {
        flash(t('cases.detail.saveError', 'Could not save.'), 'error')
      }
    },
    [canEdit, caseId, caseRow?.closedAt, loadCase, t],
  )

  const saveCustomer = React.useCallback(
    async (next: string | null) => {
      if (!caseId || !canEdit || caseRow?.closedAt) return
      const trimmed = typeof next === 'string' ? next.trim() : ''
      if (!trimmed.length) {
        flash(t('cases.detail.customerRequired', 'Customer is required.'), 'error')
        return
      }
      try {
        await updateCrud(
          'cases',
          { id: caseId, customerEntityId: trimmed },
          { errorMessage: t('cases.detail.saveError', 'Could not save.') },
        )
        flash(t('cases.detail.saved', 'Saved.'), 'success')
        await loadCase()
      } catch {
        flash(t('cases.detail.saveError', 'Could not save.'), 'error')
      }
    },
    [canEdit, caseId, caseRow?.closedAt, loadCase, t],
  )

  const saveOptionalRelation = React.useCallback(
    async (field: 'resourceId' | 'procurementProcessId' | 'insurancePolicyId', next: string | null) => {
      if (!caseId || !canEdit || caseRow?.closedAt) return
      const trimmed = typeof next === 'string' ? next.trim() : ''
      const value = trimmed.length ? trimmed : null
      try {
        await updateCrud(
          'cases',
          { id: caseId, [field]: value },
          { errorMessage: t('cases.detail.saveError', 'Could not save.') },
        )
        flash(t('cases.detail.saved', 'Saved.'), 'success')
        await loadCase()
      } catch {
        flash(t('cases.detail.saveError', 'Could not save.'), 'error')
      }
    },
    [canEdit, caseId, caseRow?.closedAt, loadCase, t],
  )

  const takeCase = React.useCallback(async () => {
    if (!caseId || !canEdit || caseRow?.closedAt || !currentUserId) return
    try {
      await updateCrud(
        'cases',
        { id: caseId, ownerUserId: currentUserId },
        { errorMessage: t('cases.detail.saveError', 'Could not save.') },
      )
      flash(t('cases.detail.tookOwnership', 'You are now the owner of this case.'), 'success')
      await loadCase()
      await loadProcedure()
    } catch {
      flash(t('cases.detail.saveError', 'Could not save.'), 'error')
    }
  }, [canEdit, caseId, caseRow?.closedAt, currentUserId, loadCase, loadProcedure, t])

  const closeCase = React.useCallback(async () => {
    if (!caseId || !canClose || !canEdit) return
    const procRunning = Boolean(procedure?.startedAt && procedure?.currentBlock)
    if (!procRunning) {
      setCloseCaseDialog({ open: true, variant: 'abortedOnly' })
      return
    }
    if (procRunning && canCloseInterruptProcedure) {
      setCloseCaseDialog({ open: true, variant: 'choice' })
      return
    }
  }, [
    canClose,
    canCloseInterruptProcedure,
    canEdit,
    caseId,
    loadCase,
    loadProcedure,
    procedure?.currentBlock,
    procedure?.startedAt,
    t,
  ])

  const handleCloseCaseDialogConfirm = React.useCallback(
    async (outcome: CaseInterruptOutcome, closingNote: string) => {
      if (!caseId || !canClose || !canEdit) return
      setInterruptClosing(true)
      try {
        await updateCrud(
          'cases',
          {
            id: caseId,
            closedAt: new Date().toISOString(),
            statusValue: outcome,
            ...(closingNote.length ? { closingNote } : {}),
          },
          { errorMessage: t('cases.detail.saveError', 'Could not save.') },
        )
        flash(
          outcome === 'aborted'
            ? t('cases.detail.abortedFlash', 'Case marked as rejected.')
            : t('cases.detail.closedInterruptFlash', 'Case closed. The procedure was interrupted.'),
          'success',
        )
        setCloseCaseDialog((s) => ({ ...s, open: false }))
        await loadCase()
        await loadProcedure()
      } catch (err) {
        const msg = err instanceof Error ? err.message.trim() : ''
        if (
          msg === 'cases.procedure.interruptOutcomeRequired' ||
          msg === 'cases.closeWithoutActiveStepRequiresAborted'
        ) {
          flash(t(msg, msg), 'error')
        } else {
          flash(t('cases.detail.saveError', 'Could not save.'), 'error')
        }
      } finally {
        setInterruptClosing(false)
      }
    },
    [canClose, canEdit, caseId, loadCase, loadProcedure, t],
  )

  const addNote = React.useCallback(async () => {
    if (!caseId || !note.trim() || caseRow?.closedAt) return
    const call = await apiCall<{ error?: string }>(`/api/cases/${encodeURIComponent(caseId)}/timeline`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ eventType: 'note', body: note.trim() }),
    })
    if (!call.ok) {
      const err =
        call.result && typeof call.result === 'object' && typeof (call.result as { error?: unknown }).error === 'string'
          ? (call.result as { error: string }).error
          : null
      flash(err === 'cases.timeline.caseClosed' ? t(err, 'This case is closed.') : t('cases.errors.timelineAppend', 'Failed to add timeline event.'), 'error')
      return
    }
    setNote('')
    void loadTimeline()
  }, [caseId, caseRow?.closedAt, loadTimeline, note, t])

  const messageColumns = React.useMemo<ColumnDef<CaseMessageRow>[]>(
    () => [
      {
        accessorKey: 'sentAt',
        header: t('cases.detail.messages.column.date', 'Date'),
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.sentAt ? formatDateTime(row.original.sentAt) ?? row.original.sentAt : '—'}
          </span>
        ),
      },
      {
        accessorKey: 'subject',
        header: t('cases.detail.messages.column.title', 'Title'),
        cell: ({ row }) => (
          <span className="text-sm font-medium">{row.original.subject?.trim() ? row.original.subject : '—'}</span>
        ),
      },
      {
        accessorKey: 'recipientDisplay',
        header: t('cases.detail.messages.column.recipient', 'Recipient'),
        cell: ({ row }) => <span className="text-sm">{row.original.recipientDisplay}</span>,
      },
      {
        accessorKey: 'channelKind',
        header: t('cases.detail.messages.column.channel', 'Channel'),
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.channelKind === 'email'
              ? t('cases.detail.messages.channel.email', 'Email')
              : t('cases.detail.messages.channel.inApp', 'In-app')}
          </span>
        ),
      },
      {
        id: 'open',
        header: '',
        meta: { className: 'text-right whitespace-nowrap w-[1%]' },
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" asChild>
              <Link
                href={`/backend/messages/${encodeURIComponent(row.original.id)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="size-4 shrink-0" aria-hidden />
                {t('common.open', 'Open')}
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [t],
  )

  const procedurePlaybookDisplayLabel = React.useMemo(() => {
    if (!procedure?.playbookId?.trim()) return ''
    return (
      formatProcedurePlaybookLabel(
        procedure.playbookTitle?.trim() ?? '',
        procedure.playbookVersion ?? null,
        t,
      ).trim() ||
      procedure.playbookTitle?.trim() ||
      procedure.playbookId?.trim() ||
      ''
    )
  }, [procedure?.playbookId, procedure?.playbookTitle, procedure?.playbookVersion, t])

  if (!caseId) return null

  if (!loaded) {
    return (
      <Page>
        <PageBody>
          <LoadingMessage label={t('cases.detail.loading', 'Loading case…')} />
        </PageBody>
      </Page>
    )
  }

  if (!caseRow) {
    return (
      <>
        <ApplyBreadcrumb
          breadcrumb={[
            { label: 'Cases', labelKey: 'cases.list.title', href: '/backend/cases' },
            { label: t('cases.errors.notFound', 'Case not found.') },
          ]}
          title={t('cases.errors.notFound', 'Case not found.')}
        />
        <Page>
          <PageBody>
            <FormHeader
              mode="detail"
              backHref="/backend/cases"
              backLabel={t('cases.detail.backToList', 'Back to cases')}
              entityTypeLabel={t('cases.detail.title', 'Case')}
              title={t('cases.errors.notFound', 'Case not found.')}
            />
          </PageBody>
        </Page>
      </>
    )
  }

  const crumbTitle = truncateCaseBreadcrumbTitle(caseRow.title)
  const isCaseTerminal = Boolean(caseRow.closedAt)
  const canMutate = canEdit && !isCaseTerminal
  const showTakeCaseAction = Boolean(canMutate && !caseRow.ownerUserId?.trim() && currentUserId)
  const procedureRunning = Boolean(procedure?.startedAt && procedure?.currentBlock)
  const closeBlockedByRunningProcedure = Boolean(procedureRunning && !canCloseInterruptProcedure)
  const showCloseCaseAction = Boolean(canEdit && canClose && !caseRow.closedAt)
  const caseCustomerId = caseRow.customerEntityId?.trim() ?? ''
  const hasCaseCustomerForRelations = z.string().uuid().safeParse(caseCustomerId).success

  return (
    <>
      <ApplyBreadcrumb
        breadcrumb={[
          { label: 'Cases', labelKey: 'cases.list.title', href: '/backend/cases' },
          { label: crumbTitle },
        ]}
        title={crumbTitle}
      />
      <Page>
        <PageBody>
          {ConfirmDialogElement}
          <CaseInterruptCloseDialog
            open={closeCaseDialog.open}
            variant={closeCaseDialog.variant}
            onOpenChange={(next) => setCloseCaseDialog((s) => ({ ...s, open: next }))}
            loading={interruptClosing}
            onConfirm={(outcome, note) => void handleCloseCaseDialogConfirm(outcome, note)}
          />
          <FormHeader
            mode="detail"
            backHref="/backend/cases"
            backLabel={t('cases.detail.backToList', 'Back to cases')}
            entityTypeLabel={t('cases.detail.title', 'Case')}
            title={caseRow.title}
            utilityActions={
              <>
                {showTakeCaseAction ? (
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void takeCase()}>
                    <UserPlus className="size-4 shrink-0" aria-hidden />
                    {t('cases.detail.takeCase', 'Take case')}
                  </Button>
                ) : null}
                {showCloseCaseAction && canMutate ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={closeBlockedByRunningProcedure}
                    title={
                      closeBlockedByRunningProcedure
                        ? t(
                            'cases.procedure.closeBlockedRunning',
                            'Close is blocked while the procedure is running. Ask an administrator for permission to interrupt.',
                          )
                        : undefined
                    }
                    onClick={() => void closeCase()}
                  >
                    <CircleCheck className="size-4 shrink-0" aria-hidden />
                    {t('cases.detail.closeCase', 'Close case')}
                  </Button>
                ) : null}
              </>
            }
          />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[7fr_3fr] lg:items-start">
          <div className="min-w-0">
            <DetailTabsLayout<CaseDetailTabId>
              tabs={caseTabs}
              activeTab={tab}
              onTabChange={setTab}
              sectionAction={null}
              onSectionAction={() => {}}
              navAriaLabel={t('cases.detail.tabs.nav', 'Case sections')}
              panelContentKey={tab}
            >
              {tab === 'details' ? (
                <div className="mt-4 space-y-4">
                <div className="rounded-lg border bg-card px-4 py-3">
                  <h2 className="text-sm font-semibold">{t('cases.form.groups.basics', 'Basics')}</h2>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
                  <InlineTextEditor
                    label={t('cases.list.columns.title', 'Title')}
                    value={caseRow.title}
                    emptyLabel="—"
                    onSave={saveTitle}
                    variant="muted"
                    activateOnClick={canMutate}
                    showEditTrigger={canMutate}
                    validator={(v) => (v.trim().length ? null : t('cases.detail.titleRequired', 'Title is required.'))}
                  />
                  <div className="md:min-w-0">
                    <InlineSelectEditor
                      label={t('cases.list.columns.customer', 'Customer')}
                      value={caseRow.customerEntityId ?? ''}
                      emptyLabel={t(
                        'cases.detail.customerEmpty',
                        'No customer linked — click to choose.',
                      )}
                      options={[]}
                      onSave={saveCustomer}
                      variant="muted"
                      activateOnClick={canMutate}
                      showEditTrigger={canMutate}
                      embedEditTriggerInDisplay={true}
                      renderEditor={({ value: draft, onChange }) => (
                        <EntitySearchCombobox
                          value={draft}
                          onChange={onChange}
                          options={mergeEntitySearchOption(
                            [],
                            draft,
                            draft === caseRow.customerEntityId?.trim() ? customerLabel || draft : draft,
                          )}
                          onRemoteSearch={async (q) => {
                            const rows = await remoteSearchCustomerEntities(q)
                            return mergeEntitySearchOption(
                              rows,
                              draft,
                              draft === caseRow.customerEntityId?.trim() ? customerLabel || draft : draft,
                            )
                          }}
                          placeholder={t('cases.form.customerSearch', 'Search customers…')}
                          disabled={!canMutate}
                          createInNewTabHref="/backend/customers/companies/create"
                          createInNewTabAriaLabel={t(
                            'cases.form.customerAddCompanyTab',
                            'Open new company form in a new tab',
                          )}
                        />
                      )}
                      renderDisplayActions={({ requestEdit }) => {
                        const pid = caseRow.customerEntityId?.trim() ?? ''
                        const preview = pid ? customerAssocPreview : null
                        const openHref = preview?.recordHref?.trim() ? preview.recordHref.trim() : null
                        if (!requestEdit && !openHref) return null
                        return (
                          <>
                            {requestEdit ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="pointer-events-auto h-8 w-8 shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  requestEdit()
                                }}
                              >
                                <Pencil className="h-4 w-4" aria-hidden />
                              </Button>
                            ) : null}
                            {openHref ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                asChild
                                className="pointer-events-auto shrink-0"
                              >
                                <Link
                                  href={openHref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2"
                                >
                                  <ExternalLink className="size-4 shrink-0" aria-hidden />
                                  {t('common.open', 'Open')}
                                </Link>
                              </Button>
                            ) : null}
                          </>
                        )
                      }}
                      renderDisplay={({ value: vid, emptyLabel: empty }) => {
                        const id = typeof vid === 'string' ? vid.trim() : ''
                        const pid = caseRow.customerEntityId?.trim() ?? ''
                        const preview = id && pid === id ? customerAssocPreview : null
                        if (!id) {
                          return (
                            <p className="min-h-9 text-sm text-muted-foreground">{empty}</p>
                          )
                        }
                        const nameOnly =
                          preview?.title ?? (pid === id ? customerLabel || id : id)
                        return (
                          <p className="text-sm font-semibold break-words leading-snug">{nameOnly}</p>
                        )
                      }}
                    />
                  </div>
                  </div>
                </div>

                <div className="rounded-lg border bg-card px-4 py-3">
                  <AttachmentsSection
                    entityId={E.cases.service_case}
                    recordId={caseRow.id}
                    title={t('cases.detail.attachments.title', 'Attachments')}
                    description={t(
                      'cases.detail.attachments.description',
                      'Files linked to this case — upload from disk or drag them here.',
                    )}
                    uploadDisabled={isCaseTerminal}
                  />
                </div>
                </div>
              ) : tab === 'timeline' ? (
                <div className="mt-4 space-y-4">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <span className="block text-sm font-medium">{t('cases.detail.timelineNoteField', 'Note text')}</span>
                    <textarea
                      className={`${CRUD_FORM_TEXTAREA_CLASS} w-full min-w-0`}
                      rows={3}
                      placeholder={t('cases.detail.timelinePlaceholder', 'Note text')}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      disabled={!canMutate}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="default"
                    size="default"
                    className="w-full gap-2 sm:w-auto"
                    disabled={!canMutate || !note.trim()}
                    onClick={() => void addNote()}
                  >
                    <Plus className="size-4 shrink-0" aria-hidden />
                    {t('cases.detail.timelineAdd', 'Add note')}
                  </Button>
                </div>
                <Separator className="mb-5 mt-1" />
                {timelineLoading ? (
                  <LoadingMessage label={t('cases.detail.timeline.loading', 'Loading history…')} />
                ) : (
                <ul className="space-y-2 text-sm">
                  {timeline.map((ev) => {
                    const when = formatDateTime(ev.occurredAt) ?? ev.occurredAt
                    const kindLabel =
                      ev.eventType === 'note'
                        ? t('cases.detail.timeline.kind.note', 'Note')
                        : t(`cases.detail.timeline.kind.${ev.eventType}`, ev.eventType)
                    return (
                      <li key={ev.id} className="rounded-lg border bg-card px-3 py-2">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-xs font-medium text-foreground">{kindLabel}</span>
                          <time className="text-xs text-muted-foreground" dateTime={ev.occurredAt}>
                            {when}
                          </time>
                        </div>
                        {ev.actorLabel || ev.actorUserId ? (
                          <div className="text-muted-foreground mt-1 text-xs">
                            {t('cases.detail.timeline.actor', 'Staff')}: {ev.actorLabel ?? ev.actorUserId}
                          </div>
                        ) : null}
                        <div className="mt-2 whitespace-pre-wrap text-sm">
                          {(() => {
                            const raw = ev.body?.trim() ?? ''
                            if (
                              ev.eventType === 'system' &&
                              raw === 'cases.timeline.system.procedure_task_scheduled' &&
                              ev.sourceRef &&
                              typeof ev.sourceRef === 'object'
                            ) {
                              const ref = ev.sourceRef as Record<string, unknown>
                              const scheduledTitle =
                                typeof ref.title === 'string' ? ref.title.trim() : ''
                              const head = t(raw, 'A task was scheduled for this procedure step.')
                              return (
                                <>
                                  <div>{head}</div>
                                  {scheduledTitle.length ? (
                                    <div className="text-muted-foreground mt-2 text-sm font-medium">
                                      {scheduledTitle}
                                    </div>
                                  ) : null}
                                </>
                              )
                            }
                            if (
                              ev.eventType === 'system' &&
                              raw === 'cases.timeline.system.invoke_procedure_launched' &&
                              ev.sourceRef &&
                              typeof ev.sourceRef === 'object'
                            ) {
                              const ref = ev.sourceRef as Record<string, unknown>
                              const slug = typeof ref.slug === 'string' ? ref.slug : ''
                              const title = typeof ref.title === 'string' ? ref.title.trim() : ''
                              const ver =
                                typeof ref.version === 'number' && Number.isFinite(ref.version)
                                  ? Math.trunc(ref.version)
                                  : null
                              const head = t(
                                raw,
                                'Linked procedure launched; active procedure replaced with latest version.',
                              )
                              const detail =
                                title.length && ver !== null
                                  ? `${title} (${slug}) · v${ver}`
                                  : title.length
                                    ? `${title} (${slug})`
                                    : slug.length
                                      ? slug
                                      : '—'
                              return (
                                <>
                                  <div>{head}</div>
                                  <div className="text-muted-foreground mt-2 whitespace-pre-wrap font-mono text-xs">
                                    {detail}
                                  </div>
                                </>
                              )
                            }
                            if (
                              ev.eventType === 'system' &&
                              raw === 'cases.timeline.system.invoke_procedure_step' &&
                              ev.sourceRef &&
                              typeof ev.sourceRef === 'object'
                            ) {
                              const refResolved = (ev.sourceRef as { resolved?: unknown }).resolved
                              const resolved = Array.isArray(refResolved) ? refResolved : []
                              const head = t(
                                raw,
                                'Procedure step: linked procedures resolved at latest active versions.',
                              )
                              const lines = resolved
                                .map((entry) => {
                                  if (!entry || typeof entry !== 'object') return null
                                  const rec = entry as Record<string, unknown>
                                  const slug = typeof rec.slug === 'string' ? rec.slug : ''
                                  const title = typeof rec.title === 'string' ? rec.title.trim() : ''
                                  const ver =
                                    typeof rec.version === 'number' && Number.isFinite(rec.version)
                                      ? Math.trunc(rec.version)
                                      : null
                                  const playbookId = typeof rec.playbookId === 'string' ? rec.playbookId : null
                                  if (!slug.length && !playbookId) return null
                                  const missing = !playbookId?.length
                                  const label =
                                    title.length && ver !== null
                                      ? `${title} (${slug}) · v${ver}`
                                      : title.length
                                        ? `${title} (${slug})`
                                        : slug
                                  return missing
                                    ? `${label} — ${t('cases.timeline.invokeProcedureMissing', 'no active version')}`
                                    : label
                                })
                                .filter((line): line is string => typeof line === 'string' && line.length > 0)
                              return (
                                <>
                                  <div>{head}</div>
                                  {lines.length ? (
                                    <ul className="text-muted-foreground mt-2 list-inside list-disc space-y-1">
                                      {lines.map((line, lineIdx) => (
                                        <li key={lineIdx} className="font-mono text-xs">
                                          {line}
                                        </li>
                                      ))}
                                    </ul>
                                  ) : null}
                                </>
                              )
                            }
                            if (ev.eventType === 'system' && raw.startsWith('cases.timeline.')) {
                              return t(raw, raw)
                            }
                            return ev.body
                          })()}
                        </div>
                      </li>
                    )
                  })}
                </ul>
                )}
                </div>
              ) : tab === 'messages' ? (
                <div className="mt-4">
                  <DataTable<CaseMessageRow>
                    embedded
                    title={t('cases.detail.messages.tableTitle', 'Messages')}
                    columns={messageColumns}
                    data={messages}
                    isLoading={messagesLoading}
                    disableRowClick
                    emptyState={
                      <p className="text-muted-foreground text-sm">{t('cases.detail.messagesEmpty', 'No messages linked yet.')}</p>
                    }
                  />
                </div>
              ) : null}
            </DetailTabsLayout>
          </div>
          <aside className="min-w-0 space-y-4">
            <div className="rounded-lg border bg-card px-4 py-3 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <h2 className="text-sm font-semibold">{t('cases.detail.currentStep', 'Current step')}</h2>
                  {procedure && !procedure.playbookId ? (
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {t(
                        'cases.detail.currentStep.lead',
                        'Choose one procedure for this case. After you start it, you cannot change it.',
                      )}
                    </p>
                  ) : null}
                  {procedure?.playbookId && !procedure.startedAt ? (
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {t(
                        'cases.detail.procedure.lockedHint',
                        'Once started, you cannot change the selected procedure.',
                      )}
                    </p>
                  ) : null}
                </div>
                {procedure?.playbookId && canPlaybooks ? (
                  <Button type="button" variant="outline" size="sm" className="shrink-0 gap-2" asChild>
                    <Link
                      href={`/backend/playbooks/${encodeURIComponent(procedure.playbookId)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-4 shrink-0" aria-hidden />
                      {t('cases.detail.procedure.openPlaybook', 'Open procedure')}
                    </Link>
                  </Button>
                ) : null}
              </div>
              {procedureLoading ? (
                <LoadingMessage label={t('cases.detail.procedure.loading', 'Loading procedure…')} />
              ) : procedure ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      {t('cases.detail.procedure.playbook', 'Procedure')}
                    </span>
                    {procedure.canSelectPlaybook && canMutate && canPlaybooks ? (
                      <EntitySearchCombobox
                        value={procedure.playbookId ?? ''}
                        onChange={(next) => {
                          if (next === (procedure.playbookId ?? '')) return
                          void runProcedurePost({ action: 'select', playbookId: next })
                        }}
                        options={mergeEntitySearchOption(
                          [],
                          procedure.playbookId?.trim() ?? '',
                          procedurePlaybookDisplayLabel || procedure.playbookId?.trim() || '',
                        )}
                        onRemoteSearch={async (q) => {
                          const rows = await remoteSearchPlaybooksForCase(q, (title, version) =>
                            formatProcedurePlaybookLabel(title, version ?? null, t))
                          return mergeEntitySearchOption(
                            rows,
                            procedure.playbookId?.trim() ?? '',
                            procedurePlaybookDisplayLabel || procedure.playbookId?.trim() || '',
                          )
                        }}
                        placeholder={t('cases.detail.procedure.selectPlaybook', 'Search procedures…')}
                        disabled={procedureAction || isCaseTerminal}
                        createInNewTabHref="/backend/playbooks/create"
                        createInNewTabAriaLabel={t('cases.detail.procedure.openNewPlaybookTab', 'Open new procedure in a new tab')}
                      />
                    ) : procedure.playbookId ? (
                      <p className="text-sm font-semibold leading-snug">
                        {procedurePlaybookDisplayLabel || procedure.playbookId}
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-sm">
                        {t('cases.detail.procedure.noPlaybook', 'No procedure selected.')}
                      </p>
                    )}
                    {procedure.canSelectPlaybook && canMutate && !canPlaybooks ? (
                      <p className="text-muted-foreground text-xs">
                        {t(
                          'cases.detail.procedure.playbooksViewRequired',
                          'Searching procedures requires playbook view permission.',
                        )}
                      </p>
                    ) : null}
                  </div>

                  {procedure.canStart && canMutate ? (
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="w-full gap-1 sm:w-auto"
                      disabled={procedureAction || isCaseTerminal}
                      onClick={() => void runProcedurePost({ action: 'start' })}
                    >
                      <PlayCircle className="size-4 shrink-0" aria-hidden />
                      {t('cases.detail.procedure.start', 'Start procedure')}
                    </Button>
                  ) : null}

                  {procedure.startedAt && procedure.currentBlock ? (
                    <CaseProcedureStepExecutor
                      block={procedure.currentBlock}
                      caseId={caseId ?? ''}
                      disabled={procedureAction || isCaseTerminal}
                      canNext={Boolean(procedure.canNext && canMutate)}
                      canSendNotify={procedure.canSendNotify}
                      canAnswerYesNo={procedure.canAnswerYesNo}
                      invokeProcedureOptions={procedure.invokeProcedureOptions ?? []}
                      canLaunchInvokeProcedure={Boolean(procedure.canLaunchInvokeProcedure && canMutate)}
                      canAssignProcedureOwner={canAssignProcedureOwner}
                      procedureTaskSummary={procedure.procedureTaskSummary ?? null}
                      canScheduleProcedureTask={Boolean(procedure.canScheduleProcedureTask && canMutate)}
                      onNext={(opts) =>
                        void runProcedurePost({
                          action: 'next',
                          ...(opts?.closingNote ? { closingNote: opts.closingNote } : {}),
                        })
                      }
                      onSendNotify={(plain) => void runProcedurePost({ action: 'sendNotify', body: plain })}
                      onAnswer={(branch) => void runProcedurePost({ action: 'answer', branch })}
                      onLaunchInvokeProcedure={(slug, ownerUserId) =>
                        void runProcedurePost({
                          action: 'launchInvokeProcedure',
                          slug,
                          ...(ownerUserId ? { ownerUserId } : {}),
                        })
                      }
                      onScheduleProcedureTask={(payload) =>
                        runProcedurePost({
                          action: 'scheduleProcedureTask',
                          title: payload.title,
                          ...(payload.body !== undefined ? { body: payload.body } : {}),
                          ...(payload.dueAt !== undefined ? { dueAt: payload.dueAt } : {}),
                        })
                      }
                    />
                  ) : null}

                  {procedure.startedAt && !procedure.currentBlock ? (
                    <p className="text-muted-foreground text-sm">
                      {t('cases.detail.procedure.finished', 'Procedure completed.')}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {t('cases.detail.procedure.loadError', 'Could not load procedure state.')}
                </p>
              )}
            </div>
            <div className="rounded-lg border bg-card px-4 py-3 space-y-3">
              <h2 className="text-sm font-semibold">{t('cases.detail.overview', 'Overview')}</h2>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">{t('cases.list.columns.status', 'Status')}</dt>
                  <dd className="mt-0.5">
                    <CaseStatusBadge statusValue={caseRow.statusValue} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('cases.detail.ownerUserId', 'Owner')}</dt>
                  <dd className="mt-0.5 break-words text-sm">
                    {caseRow.ownerUserId?.trim()
                      ? ownerDisplayLabel || caseRow.ownerUserId
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('cases.detail.openedAt', 'Opened')}</dt>
                  <dd className="mt-0.5">
                    {caseRow.openedAt ? formatDateTime(caseRow.openedAt) ?? new Date(caseRow.openedAt).toLocaleString() : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t('cases.detail.closedAt', 'Closed')}</dt>
                  <dd className="mt-0.5">
                    {caseRow.closedAt ? formatDateTime(caseRow.closedAt) ?? new Date(caseRow.closedAt).toLocaleString() : '—'}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="rounded-lg border bg-card px-4 py-3 space-y-4">
              <h2 className="text-sm font-semibold">{t('cases.form.groups.relations', 'Relations')}</h2>
              <div className="space-y-2">
                <span className="block text-sm font-medium">{t('cases.form.relations.resource', 'Resource')}</span>
                <InlineSelectEditor
                  label={t('cases.form.relations.resource', 'Resource')}
                  hideLabel
                  value={caseRow.resourceId ?? ''}
                  emptyLabel={t('cases.detail.relationEmpty', 'None — click to link.')}
                  options={[]}
                  onSave={(v) => saveOptionalRelation('resourceId', v)}
                  variant="muted"
                  activateOnClick={canMutate}
                  showEditTrigger={canMutate}
                  embedEditTriggerInDisplay={canMutate}
                  renderEditor={({ value: draft, onChange }) => (
                    <EntitySearchCombobox
                      value={draft}
                      onChange={onChange}
                      options={mergeEntitySearchOption(
                        [],
                        draft,
                        draft === caseRow.resourceId?.trim() ? resourceRelLabel || draft : draft,
                      )}
                      onRemoteSearch={async (q) => {
                        const rows = await remoteSearchResourcesForCaseCustomer(
                          caseRow.customerEntityId,
                          q,
                        )
                        return mergeEntitySearchOption(
                          rows,
                          draft,
                          draft === caseRow.resourceId?.trim() ? resourceRelLabel || draft : draft,
                        )
                      }}
                      placeholder={
                        hasCaseCustomerForRelations
                          ? t('cases.form.relations.resourceSearch', 'Search resources…')
                          : t(
                              'cases.form.relations.resourceSearchUnassigned',
                              'Search resources without a linked customer…',
                            )
                      }
                      disabled={!canMutate}
                    />
                  )}
                  renderDisplay={({ value: vid, emptyLabel: empty, requestEdit }) => {
                    const id = typeof vid === 'string' ? vid.trim() : ''
                    const pid = caseRow.resourceId?.trim() ?? ''
                    const openHref = id ? `/backend/resources/resources/${encodeURIComponent(id)}` : null
                    return (
                      <CaseRelationPreviewDisplay
                        emptyLabel={empty}
                        valueId={id}
                        resolvedLabel={pid === id ? resourceRelLabel || id : id}
                        openHref={openHref}
                        requestEdit={requestEdit}
                        translate={t}
                      />
                    )
                  }}
                />
              </div>
              <div className="space-y-2">
                <span className="block text-sm font-medium">{t('cases.form.relations.procurementProcess', 'Procurement process')}</span>
                <InlineSelectEditor
                  label={t('cases.form.relations.procurementProcess', 'Procurement process')}
                  hideLabel
                  value={caseRow.procurementProcessId ?? ''}
                  emptyLabel={t('cases.detail.relationEmpty', 'None — click to link.')}
                  options={[]}
                  onSave={(v) => saveOptionalRelation('procurementProcessId', v)}
                  variant="muted"
                  activateOnClick={canMutate}
                  showEditTrigger={canMutate}
                  embedEditTriggerInDisplay={canMutate}
                  renderEditor={({ value: draft, onChange }) => (
                    <EntitySearchCombobox
                      value={draft}
                      onChange={onChange}
                      options={mergeEntitySearchOption(
                        [],
                        draft,
                        draft === caseRow.procurementProcessId?.trim() ? processRelLabel || draft : draft,
                      )}
                      onRemoteSearch={async (q) => {
                        const rows = await remoteSearchProcurementProcessesForCaseCustomer(
                          caseRow.customerEntityId,
                          q,
                        )
                        return mergeEntitySearchOption(
                          rows,
                          draft,
                          draft === caseRow.procurementProcessId?.trim() ? processRelLabel || draft : draft,
                        )
                      }}
                      placeholder={
                        hasCaseCustomerForRelations
                          ? t('cases.form.relations.procurementProcessSearch', 'Search purchase processes…')
                          : t(
                              'cases.form.relations.procurementProcessSearchUnassigned',
                              'Search purchase processes without a linked customer…',
                            )
                      }
                      disabled={!canMutate}
                    />
                  )}
                  renderDisplay={({ value: vid, emptyLabel: empty, requestEdit }) => {
                    const id = typeof vid === 'string' ? vid.trim() : ''
                    const pid = caseRow.procurementProcessId?.trim() ?? ''
                    const openHref = id ? `/backend/procurement/processes/${encodeURIComponent(id)}` : null
                    return (
                      <CaseRelationPreviewDisplay
                        emptyLabel={empty}
                        valueId={id}
                        resolvedLabel={pid === id ? processRelLabel || id : id}
                        openHref={openHref}
                        requestEdit={requestEdit}
                        translate={t}
                      />
                    )
                  }}
                />
              </div>
              <div className="space-y-2">
                <span className="block text-sm font-medium">{t('cases.form.relations.insurancePolicy', 'Insurance policy')}</span>
                <InlineSelectEditor
                  label={t('cases.form.relations.insurancePolicy', 'Insurance policy')}
                  hideLabel
                  value={caseRow.insurancePolicyId ?? ''}
                  emptyLabel={t('cases.detail.relationEmpty', 'None — click to link.')}
                  options={[]}
                  onSave={(v) => saveOptionalRelation('insurancePolicyId', v)}
                  variant="muted"
                  activateOnClick={canMutate}
                  showEditTrigger={canMutate}
                  embedEditTriggerInDisplay={canMutate}
                  renderEditor={({ value: draft, onChange }) => (
                    <EntitySearchCombobox
                      value={draft}
                      onChange={onChange}
                      options={mergeEntitySearchOption(
                        [],
                        draft,
                        draft === caseRow.insurancePolicyId?.trim() ? policyRelLabel || draft : draft,
                      )}
                      onRemoteSearch={async (q) => {
                        const rows = await remoteSearchInsurancePoliciesForCaseCustomer(
                          caseRow.customerEntityId,
                          q,
                        )
                        return mergeEntitySearchOption(
                          rows,
                          draft,
                          draft === caseRow.insurancePolicyId?.trim() ? policyRelLabel || draft : draft,
                        )
                      }}
                      placeholder={
                        hasCaseCustomerForRelations
                          ? t('cases.form.relations.insurancePolicySearch', 'Search policies by number…')
                          : t('cases.form.relations.selectCustomerFirst', 'Select a customer first…')
                      }
                      disabled={!canMutate || !hasCaseCustomerForRelations}
                    />
                  )}
                  renderDisplay={({ value: vid, emptyLabel: empty, requestEdit }) => {
                    const id = typeof vid === 'string' ? vid.trim() : ''
                    const pid = caseRow.insurancePolicyId?.trim() ?? ''
                    const openHref = id ? `/backend/insurance-desk/policies/${encodeURIComponent(id)}` : null
                    return (
                      <CaseRelationPreviewDisplay
                        emptyLabel={empty}
                        valueId={id}
                        resolvedLabel={pid === id ? policyRelLabel || id : id}
                        openHref={openHref}
                        requestEdit={requestEdit}
                        translate={t}
                      />
                    )
                  }}
                />
              </div>
            </div>
          </aside>
        </div>
        </PageBody>
      </Page>
    </>
  )
}
