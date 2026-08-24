'use client'

import * as React from 'react'
import Link from 'next/link'
import { CircleOff, Pencil, Plus, RotateCcw } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { formatDateTime } from '@open-mercato/shared/lib/time'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { LoadingMessage } from '@open-mercato/ui/backend/detail'
import { Button } from '@open-mercato/ui/primitives/button'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { SimpleTooltip, TooltipProvider } from '@open-mercato/ui/primitives/tooltip'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { TAXI_FLEET_BASE } from '../backend/taxi-fleet/paths'
import { getWeekEnd } from '../lib/weekUtils'
import { expenseGrossToNet, normalizeExpenseVatRatePercent } from '../lib/expenseVat'
import {
  findSettlementCostExclusion,
  type SettlementCostExclusion,
} from '../lib/settlementCostExclusions'
import { useTaxiFleetLabels } from './useTaxiFleetLabels'
import { DriverFinancialEntryDialog, type FinancialEntryRow } from './DriverFinancialEntryDialog'
import { SettlementExpenseReceiptOcrBadge } from './SettlementExpenseReceiptOcrBadge'
import type { DriverExpenseWarning } from '../lib/driverExpenses'
import {
  TaxiFleetDialogForm,
  TaxiFleetDialogFrame,
  useTaxiFleetDialogShortcuts,
} from './TaxiFleetDialogShell'

type SettlementExpenseRow = {
  id: string
  costType?: string | null
  tripId?: string | null
  amount: string
  vatRatePercent?: string | null
  currencyCode?: string
  documentNumber?: string | null
  occurredAt?: string | null
  notes?: string | null
  receiptAttachmentId?: string | null
  isDocumentDuplicate?: boolean
  ocrStatus?: string | null
  warnings?: DriverExpenseWarning[]
}

function expenseWarningLabel(
  t: (key: string, fallback?: string) => string,
  warning: DriverExpenseWarning,
): string {
  return t(
    `taxi_fleet.driverApp.expenses.warnings.${warning.code}`,
    warning.message || warning.code,
  )
}

function SettlementExpenseReceiptCell({
  row,
  t,
}: {
  row: SettlementExpenseRow
  t: (key: string, fallback?: string) => string
}) {
  const warnings = row.warnings ?? []
  const showWarnings =
    warnings.length > 0 || row.ocrStatus === 'needs_review' || row.ocrStatus === 'failed'

  const messages: string[] = warnings.map((warning) => expenseWarningLabel(t, warning))
  if (messages.length === 0 && row.ocrStatus === 'needs_review') {
    messages.push(
      t(
        'taxi_fleet.settlements.receipt.needsReview',
        'Document needs review — check OCR results.',
      ),
    )
  }
  if (messages.length === 0 && row.ocrStatus === 'failed') {
    messages.push(
      t(
        'taxi_fleet.settlements.receipt.ocrFailed',
        'Receipt OCR failed — verify or re-upload the document.',
      ),
    )
  }

  return (
    <div className="space-y-1.5">
      <SettlementExpenseReceiptOcrBadge item={row} />
      {showWarnings && messages.length > 0 ? (
        <ul className="max-w-52 space-y-0.5 text-xs text-amber-800 dark:text-amber-200">
          {messages.map((message, index) => (
            <li key={`${row.id}-warn-${index}`}>{message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

type SettlementCostsToReconcilePanelProps = {
  settlementId: string
  teamMemberId: string
  weekStart: string
  readOnly: boolean
  excludedCosts: SettlementCostExclusion[]
  onUpdated: () => Promise<void>
}

function SettlementStatusBadge({
  isExcluded,
  exclusionComment,
  includedLabel,
  excludedLabel,
}: {
  isExcluded: boolean
  exclusionComment?: string
  includedLabel: string
  excludedLabel: string
}) {
  if (isExcluded) {
    return (
      <SimpleTooltip content={exclusionComment}>
        <Badge variant="outline" className="cursor-default">
          {excludedLabel}
        </Badge>
      </SimpleTooltip>
    )
  }

  return <Badge variant="secondary">{includedLabel}</Badge>
}

function formatMoney(value: number, currency = 'PLN'): string {
  if (!Number.isFinite(value)) return '—'
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

export function SettlementCostsToReconcilePanel({
  settlementId,
  teamMemberId,
  weekStart,
  readOnly,
  excludedCosts,
  onUpdated,
}: SettlementCostsToReconcilePanelProps) {
  const t = useT()
  const { resolveCostTypeLabel } = useTaxiFleetLabels()
  const [rows, setRows] = React.useState<SettlementExpenseRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [addOpen, setAddOpen] = React.useState(false)
  const [editEntry, setEditEntry] = React.useState<FinancialEntryRow | null>(null)
  const [excludeEntryId, setExcludeEntryId] = React.useState<string | null>(null)
  const [excludeComment, setExcludeComment] = React.useState('')
  const [isSavingExclusion, setIsSavingExclusion] = React.useState(false)
  const excludeDialogRef = React.useRef<HTMLDivElement | null>(null)

  const weekEnd = React.useMemo(() => getWeekEnd(weekStart), [weekStart])

  const loadRows = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({
      page: '1',
      pageSize: '500',
      teamMemberId,
      kind: 'expense',
      dateFrom: weekStart,
      dateTo: weekEnd,
      sortField: 'occurredAt',
      sortDir: 'asc',
    })
    const call = await apiCall<{ items: SettlementExpenseRow[] }>(
      `/api/taxi_fleet/financial-entries?${params.toString()}`,
    )
    if (!call.ok) {
      setError(t('taxi_fleet.settlements.costsToReconcile.loadError', 'Could not load costs for this week.'))
      setRows([])
    } else {
      setRows(Array.isArray(call.result?.items) ? call.result.items : [])
    }
    setLoading(false)
  }, [teamMemberId, weekEnd, weekStart, t])

  React.useEffect(() => {
    void loadRows()
  }, [loadRows])

  const handleEntrySaved = React.useCallback(async () => {
    await loadRows()
    await onUpdated()
    flash(t('taxi_fleet.settlements.costsToReconcile.saved', 'Cost saved and settlement recalculated.'), 'success')
  }, [loadRows, onUpdated, t])

  const persistExcludedCosts = React.useCallback(
    async (nextExcludedCosts: SettlementCostExclusion[]) => {
      await updateCrud(
        'taxi_fleet/settlements',
        {
          id: settlementId,
          excludedCosts: nextExcludedCosts.map((item) => ({
            financialEntryId: item.financialEntryId,
            comment: item.comment,
          })),
        },
        { errorMessage: t('taxi_fleet.settlements.costsToReconcile.excludeError', 'Could not update cost exclusions.') },
      )
      await onUpdated()
    },
    [onUpdated, settlementId, t],
  )

  const openExcludeDialog = (entryId: string) => {
    const existing = findSettlementCostExclusion(excludedCosts, entryId)
    setExcludeEntryId(entryId)
    setExcludeComment(existing?.comment ?? '')
  }

  const closeExcludeDialog = () => {
    setExcludeEntryId(null)
    setExcludeComment('')
  }

  const submitExclude = async () => {
    if (!excludeEntryId) return
    const comment = excludeComment.trim()
    if (!comment) {
      flash(t('taxi_fleet.settlements.costsToReconcile.excludeCommentRequired', 'Enter a reason for exclusion.'), 'error')
      return
    }
    setIsSavingExclusion(true)
    try {
      const withoutCurrent = excludedCosts.filter((item) => item.financialEntryId !== excludeEntryId)
      await persistExcludedCosts([
        ...withoutCurrent,
        {
          financialEntryId: excludeEntryId,
          comment,
          excludedAt: new Date().toISOString(),
        },
      ])
      flash(t('taxi_fleet.settlements.costsToReconcile.excluded', 'Cost excluded from settlement.'), 'success')
      closeExcludeDialog()
    } finally {
      setIsSavingExclusion(false)
    }
  }

  const includeCost = async (entryId: string) => {
    const next = excludedCosts.filter((item) => item.financialEntryId !== entryId)
    await persistExcludedCosts(next)
    flash(t('taxi_fleet.settlements.costsToReconcile.included', 'Cost included in settlement again.'), 'success')
  }

  const handleExcludeDialogKeyDown = useTaxiFleetDialogShortcuts({
    contentRef: excludeDialogRef,
    onCancel: closeExcludeDialog,
    canSubmit: !isSavingExclusion && excludeComment.trim().length > 0,
  })

  const includedTotals = React.useMemo(() => {
    let gross = 0
    let net = 0
    for (const row of rows) {
      if (findSettlementCostExclusion(excludedCosts, row.id)) continue
      const amountGross = Number(row.amount)
      if (!Number.isFinite(amountGross)) continue
      const vatRate = normalizeExpenseVatRatePercent(row.vatRatePercent)
      gross += amountGross
      net += expenseGrossToNet(amountGross, vatRate)
    }
    return { gross, net }
  }, [excludedCosts, rows])

  if (loading) {
    return (
      <section className="rounded-lg border bg-card px-4 py-3">
        <LoadingMessage label={t('taxi_fleet.settlements.costsToReconcile.loading', 'Loading costs…')} />
      </section>
    )
  }

  if (error) {
    return (
      <section className="space-y-2 rounded-lg border bg-card px-4 py-3">
        <h3 className="text-sm font-semibold">
          {t('taxi_fleet.settlements.costsToReconcile.title', 'Costs to reconcile')}
        </h3>
        <p className="text-sm text-destructive">{error}</p>
      </section>
    )
  }

  return (
    <>
      <section className="space-y-3 rounded-lg border bg-card px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">
              {t('taxi_fleet.settlements.costsToReconcile.title', 'Costs to reconcile')}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                'taxi_fleet.settlements.costsToReconcile.hint',
                'Driver expenses included in this settlement week ({from} – {to}).',
                { from: weekStart, to: weekEnd },
              )}
            </p>
          </div>
          {!readOnly ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 size-4" aria-hidden />
              {t('taxi_fleet.settlements.costsToReconcile.add', 'Add cost')}
            </Button>
          ) : null}
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('taxi_fleet.settlements.costsToReconcile.empty', 'No costs registered for this week.')}
          </p>
        ) : (
          <TooltipProvider>
            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('taxi_fleet.settlements.ledger.date', 'Date')}</th>
                    <th className="px-3 py-2 font-medium">{t('taxi_fleet.settlements.costs.line', 'Type')}</th>
                    <th className="px-3 py-2 font-medium">
                      {t('taxi_fleet.settlements.costsToReconcile.settlementStatus', 'In settlement')}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {t('taxi_fleet.settlements.receipt.column', 'Receipt')}
                    </th>
                    <th className="px-3 py-2 font-medium">{t('taxi_fleet.financial.documentNumber', 'Document number')}</th>
                    <th className="px-3 py-2 font-medium">{t('taxi_fleet.settlements.ledger.trip', 'Trip')}</th>
                    <th className="px-3 py-2 font-medium text-right">{t('taxi_fleet.settlements.costs.gross', 'Gross')}</th>
                    <th className="px-3 py-2 font-medium text-right">{t('taxi_fleet.settlements.costs.net', 'Net')}</th>
                    {!readOnly ? <th className="px-3 py-2" aria-hidden /> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const exclusion = findSettlementCostExclusion(excludedCosts, row.id)
                    const isExcluded = Boolean(exclusion)
                    const gross = Number(row.amount)
                    const vatRate = normalizeExpenseVatRatePercent(row.vatRatePercent)
                    const net = expenseGrossToNet(gross, vatRate)
                    const currency = row.currencyCode ?? 'PLN'
                    return (
                      <tr
                        key={row.id}
                        className={isExcluded ? 'bg-muted/40 text-muted-foreground' : undefined}
                      >
                        <td className="px-3 py-2">
                          {formatDateTime(row.occurredAt ?? '') ?? row.occurredAt?.slice(0, 10) ?? '—'}
                        </td>
                        <td className="px-3 py-2">
                          {row.costType ? resolveCostTypeLabel(row.costType) : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <SettlementStatusBadge
                            isExcluded={isExcluded}
                            exclusionComment={exclusion?.comment}
                            includedLabel={t('taxi_fleet.settlements.costsToReconcile.includedBadge', 'Included')}
                            excludedLabel={t('taxi_fleet.settlements.costsToReconcile.excludedBadge', 'Excluded')}
                          />
                        </td>
                        <td className="px-3 py-2 align-top">
                          <SettlementExpenseReceiptCell row={row} t={t} />
                        </td>
                        <td className="px-3 py-2">{row.documentNumber ?? '—'}</td>
                        <td className="px-3 py-2">
                          {row.tripId ? (
                            <Link
                              href={`${TAXI_FLEET_BASE}/trips/${encodeURIComponent(row.tripId)}`}
                              className="text-primary hover:underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {t('taxi_fleet.settlements.ledger.viewTrip', 'View trip')}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(gross, currency)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatMoney(net, currency)}</td>
                        {!readOnly ? (
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setEditEntry({
                                    id: row.id,
                                    kind: 'expense',
                                    costType: row.costType ?? null,
                                    tripId: row.tripId ?? null,
                                    amount: row.amount,
                                    currencyCode: row.currencyCode ?? 'PLN',
                                    documentNumber: row.documentNumber ?? null,
                                    occurredAt: row.occurredAt ?? null,
                                    notes: row.notes ?? null,
                                  })
                                }
                              >
                                <Pencil className="mr-2 size-4 shrink-0" aria-hidden />
                                {t('common.edit', 'Edit')}
                              </Button>
                              {isExcluded ? (
                                <Button type="button" size="sm" variant="outline" onClick={() => void includeCost(row.id)}>
                                  <RotateCcw className="mr-2 size-4 shrink-0" aria-hidden />
                                  {t('taxi_fleet.settlements.costsToReconcile.include', 'Include in settlement')}
                                </Button>
                              ) : (
                                <Button type="button" size="sm" variant="secondary" onClick={() => openExcludeDialog(row.id)}>
                                  <CircleOff className="mr-2 size-4 shrink-0" aria-hidden />
                                  {t('taxi_fleet.settlements.costsToReconcile.exclude', 'Exclude from settlement')}
                                </Button>
                              )}
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    )
                  })}
                  <tr className="border-t bg-muted/30 font-semibold">
                    <td className="px-3 py-2" colSpan={6}>
                      {t('taxi_fleet.settlements.costsToReconcile.includedTotals', 'Included totals')}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(includedTotals.gross)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(includedTotals.net)}</td>
                    {!readOnly ? <td className="px-3 py-2" aria-hidden /> : null}
                  </tr>
                </tbody>
              </table>
            </div>
          </TooltipProvider>
        )}
      </section>

      <DriverFinancialEntryDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        teamMemberId={teamMemberId}
        mode="expense"
        onSaved={() => void handleEntrySaved()}
      />

      <DriverFinancialEntryDialog
        open={Boolean(editEntry)}
        onOpenChange={(open) => {
          if (!open) setEditEntry(null)
        }}
        teamMemberId={teamMemberId}
        mode="expense"
        entry={editEntry}
        onSaved={() => {
          setEditEntry(null)
          void handleEntrySaved()
        }}
      />

      <TaxiFleetDialogFrame
        open={Boolean(excludeEntryId)}
        onOpenChange={(open) => {
          if (!open) closeExcludeDialog()
        }}
        title={t('taxi_fleet.settlements.costsToReconcile.excludeTitle', 'Exclude cost from settlement')}
        contentRef={excludeDialogRef}
        onKeyDown={handleExcludeDialogKeyDown}
      >
        <TaxiFleetDialogForm
          onSubmit={(event) => {
            event.preventDefault()
            void submitExclude()
          }}
          body={
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t(
                  'taxi_fleet.settlements.costsToReconcile.excludeHint',
                  'The cost stays in the ledger but is omitted from settlement totals. You can restore it later.',
                )}
              </p>
              <div className="space-y-1">
                <label htmlFor="settlement-cost-exclude-comment" className="text-sm font-medium">
                  {t('taxi_fleet.settlements.costsToReconcile.exclusionComment', 'Exclusion reason')}
                </label>
                <Textarea
                  id="settlement-cost-exclude-comment"
                  value={excludeComment}
                  onChange={(event) => setExcludeComment(event.target.value)}
                  rows={4}
                  disabled={isSavingExclusion}
                />
              </div>
            </div>
          }
          footer={
            <>
              <Button type="button" variant="outline" onClick={closeExcludeDialog} disabled={isSavingExclusion}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" disabled={isSavingExclusion}>
                {t('taxi_fleet.settlements.costsToReconcile.excludeConfirm', 'Exclude from settlement')}
              </Button>
            </>
          }
        />
      </TaxiFleetDialogFrame>
    </>
  )
}
