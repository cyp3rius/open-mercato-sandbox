'use client'

import * as React from 'react'
import Link from 'next/link'
import { ExternalLink, HandCoins, Plus } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { InjectionWidgetComponentProps } from '@open-mercato/shared/modules/widgets/injection'
import { apiCall, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { Spinner } from '@open-mercato/ui/primitives/spinner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@open-mercato/ui/primitives/dialog'
import {
  EntitySearchCombobox,
  type EntitySearchComboboxOption,
} from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import { CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'

type MembershipRow = {
  id: string
  programId: string | null
  programName: string | null
  incentivePercent: string | number | null
  role: string | null
  joinedAt: string
}

type LedgerRow = {
  id: string
  kind: string
  amount: string
  currencyCode: string
  programId: string | null
  programName: string | null
  salesOrderId: string | null
  salesOrderNumber: string | null
  createdAt: string
}

type BalanceRow = {
  currencyCode: string
  totalEarned: number
  payable: number
}

function resolveCustomerEntityId(data: unknown, context: Record<string, unknown>): string | null {
  if (typeof context.personId === 'string' && context.personId.trim()) return context.personId
  if (typeof context.companyId === 'string' && context.companyId.trim()) return context.companyId
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    const person = record.person
    if (person && typeof person === 'object' && typeof (person as { id?: unknown }).id === 'string') {
      return (person as { id: string }).id
    }
    const company = record.company
    if (company && typeof company === 'object' && typeof (company as { id?: unknown }).id === 'string') {
      return (company as { id: string }).id
    }
    if (typeof record.id === 'string') return record.id
  }
  return null
}

function formatAmount(value: string | number): string {
  const n = typeof value === 'number' ? value : Number(String(value))
  if (!Number.isFinite(n)) return String(value)
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

function programDetailHref(programId: string): string {
  return `/backend/partner_programs/programs/${encodeURIComponent(programId)}`
}

function orderDetailHref(orderId: string): string {
  return `/backend/sales/simple-orders/${encodeURIComponent(orderId)}`
}

export default function PartnerIncentivesWidget({
  context,
  data,
}: InjectionWidgetComponentProps) {
  const t = useT()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const customerEntityId = React.useMemo(
    () => resolveCustomerEntityId(data, (context ?? {}) as Record<string, unknown>),
    [context, data],
  )

  const [memberships, setMemberships] = React.useState<MembershipRow[]>([])
  const [ledger, setLedger] = React.useState<LedgerRow[]>([])
  const [balances, setBalances] = React.useState<BalanceRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [canMembers, setCanMembers] = React.useState(false)
  const [canPayout, setCanPayout] = React.useState(false)
  const [addDialogOpen, setAddDialogOpen] = React.useState(false)
  const [pickProgramId, setPickProgramId] = React.useState('')
  const [pickRole, setPickRole] = React.useState('')
  const [adding, setAdding] = React.useState(false)
  const [payoutCurrency, setPayoutCurrency] = React.useState('')
  const [payingOut, setPayingOut] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    async function loadPerm() {
      const call = await apiCall<{ granted?: string[]; ok?: boolean }>('/api/auth/feature-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          features: ['partner_programs.manage_memberships', 'partner_programs.manage_payouts'],
        }),
      })
      if (cancelled) return
      const granted = Array.isArray(call.result?.granted) ? call.result.granted : []
      setCanMembers(call.result?.ok === true || granted.includes('partner_programs.manage_memberships'))
      setCanPayout(call.result?.ok === true || granted.includes('partner_programs.manage_payouts'))
    }
    void loadPerm()
    return () => {
      cancelled = true
    }
  }, [])

  const reload = React.useCallback(async () => {
    if (!customerEntityId) return
    setLoading(true)
    try {
      const qs = `customerEntityId=${encodeURIComponent(customerEntityId)}`
      const [mem, led, bal] = await Promise.all([
        readApiResultOrThrow<{ items?: MembershipRow[] }>(
          `/api/partner_programs/memberships?${qs}`,
          undefined,
          { fallback: { items: [] } },
        ),
        readApiResultOrThrow<{ items?: LedgerRow[] }>(
          `/api/partner_programs/incentives?${qs}&page=1&pageSize=50`,
          undefined,
          { fallback: { items: [] } },
        ),
        readApiResultOrThrow<{ currencies?: BalanceRow[] }>(
          `/api/partner_programs/incentives/balance?${qs}`,
          undefined,
          { fallback: { currencies: [] } },
        ),
      ])
      setMemberships(Array.isArray(mem.items) ? mem.items : [])
      setLedger(Array.isArray(led.items) ? led.items : [])
      const currencies = Array.isArray(bal.currencies) ? bal.currencies : []
      setBalances(currencies)
      setPayoutCurrency((prev) => {
        if (prev && currencies.some((c) => c.currencyCode === prev && c.payable > 0)) return prev
        const firstPayable = currencies.find((c) => c.payable > 0)
        return firstPayable?.currencyCode ?? currencies[0]?.currencyCode ?? ''
      })
    } catch {
      flash(t('partner_programs.partnerTab.errors.load', 'Failed to load partner incentives.'), 'error')
    } finally {
      setLoading(false)
    }
  }, [customerEntityId, t])

  React.useEffect(() => {
    void reload()
  }, [reload])

  const searchPrograms = React.useCallback(
    async (query: string): Promise<EntitySearchComboboxOption[]> => {
      const params = new URLSearchParams({ page: '1', pageSize: '20', isActive: 'true' })
      if (query.trim()) params.set('search', query.trim())
      const payload = await readApiResultOrThrow<{
        items?: Array<{ id?: string; name?: string; incentivePercent?: string | number }>
      }>(`/api/partner_programs/programs?${params.toString()}`, undefined, { fallback: { items: [] } })
      const memberProgramIds = new Set(memberships.map((m) => m.programId).filter(Boolean))
      return (payload.items ?? [])
        .filter((row) => typeof row.id === 'string' && !memberProgramIds.has(row.id))
        .map((row) => {
          const pct =
            row.incentivePercent != null && String(row.incentivePercent).length
              ? ` (${String(row.incentivePercent)}%)`
              : ''
          return {
            value: String(row.id),
            label: `${typeof row.name === 'string' ? row.name : row.id}${pct}`,
          }
        })
    },
    [memberships],
  )

  const resetAddDialog = React.useCallback(() => {
    setPickProgramId('')
    setPickRole('')
  }, [])

  const handleAddMembership = React.useCallback(async () => {
    if (!customerEntityId || !pickProgramId) {
      flash(t('partner_programs.partnerTab.errors.pickProgram', 'Select a program.'), 'error')
      return
    }
    setAdding(true)
    try {
      const body: Record<string, unknown> = { customerEntityId }
      if (pickRole.trim()) body.role = pickRole.trim()
      const call = await apiCall<{ id?: string; error?: string }>(
        `/api/partner_programs/programs/${encodeURIComponent(pickProgramId)}/memberships`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      )
      if (!call.ok) {
        flash(
          typeof call.result?.error === 'string'
            ? call.result.error
            : t('partner_programs.partnerTab.errors.addMembership', 'Failed to add membership.'),
          'error',
        )
        return
      }
      flash(t('partner_programs.partnerTab.messages.membershipAdded', 'Membership added.'), 'success')
      setAddDialogOpen(false)
      resetAddDialog()
      await reload()
    } finally {
      setAdding(false)
    }
  }, [customerEntityId, pickProgramId, pickRole, reload, resetAddDialog, t])

  const handleRemoveMembership = React.useCallback(
    async (membership: MembershipRow) => {
      if (!membership.programId) return
      const confirmed = await confirm({
        title: t(
          'partner_programs.partnerTab.memberships.removeConfirm',
          'Remove this program membership?',
        ),
        variant: 'destructive',
      })
      if (!confirmed) return
      const call = await apiCall(
        `/api/partner_programs/programs/${encodeURIComponent(membership.programId)}/memberships?id=${encodeURIComponent(membership.id)}`,
        { method: 'DELETE' },
      )
      if (!call.ok) {
        flash(t('partner_programs.partnerTab.errors.removeMembership', 'Failed to remove membership.'), 'error')
        return
      }
      flash(t('partner_programs.partnerTab.messages.membershipRemoved', 'Membership removed.'), 'success')
      await reload()
    },
    [confirm, reload, t],
  )

  const handlePayout = React.useCallback(async () => {
    if (!customerEntityId || !payoutCurrency) return
    const row = balances.find((b) => b.currencyCode === payoutCurrency)
    if (!row || row.payable <= 0) {
      flash(t('partner_programs.partnerTab.errors.nothingToPay', 'Nothing to pay out for this currency.'), 'error')
      return
    }
    const confirmed = await confirm({
      title: t('partner_programs.partnerTab.payout.confirmTitle', 'Record payout?')
        .replace('{{amount}}', formatAmount(row.payable))
        .replace('{{currency}}', payoutCurrency),
    })
    if (!confirmed) return
    setPayingOut(true)
    try {
      const call = await apiCall<{ error?: string }>('/api/partner_programs/incentives/payout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ customerEntityId, currencyCode: payoutCurrency }),
      })
      if (!call.ok) {
        flash(
          typeof call.result?.error === 'string'
            ? call.result.error
            : t('partner_programs.partnerTab.errors.payout', 'Failed to create payout.'),
          'error',
        )
        return
      }
      flash(t('partner_programs.partnerTab.messages.payoutCreated', 'Payout recorded.'), 'success')
      await reload()
    } finally {
      setPayingOut(false)
    }
  }, [balances, confirm, customerEntityId, payoutCurrency, reload, t])

  const handleAddDialogKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!adding) setAddDialogOpen(false)
        return
      }
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        if (!adding && pickProgramId) void handleAddMembership()
      }
    },
    [adding, handleAddMembership, pickProgramId],
  )

  if (!customerEntityId) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('partner_programs.partnerTab.errors.noCustomer', 'Customer context is missing.')}
      </p>
    )
  }

  const selectedBalance = balances.find((b) => b.currencyCode === payoutCurrency) ?? null
  const totalEarnedAll = balances.reduce((sum, b) => sum + (Number.isFinite(b.totalEarned) ? b.totalEarned : 0), 0)
  const payableAll = balances.reduce((sum, b) => sum + (Number.isFinite(b.payable) ? b.payable : 0), 0)

  return (
    <div className="space-y-4">
      {ConfirmDialogElement}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4" />
          {t('partner_programs.partnerTab.loading', 'Loading…')}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[7fr_3fr] lg:items-start">
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="relative pe-12">
              <h3 className="text-sm font-semibold">
                {t('partner_programs.partnerTab.memberships.title', 'Program memberships')}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t(
                  'partner_programs.partnerTab.memberships.description',
                  'Programs this partner belongs to.',
                )}
              </p>
              {canMembers ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="absolute end-0 top-0 shrink-0"
                  aria-label={t('partner_programs.partnerTab.memberships.add', 'Add')}
                  onClick={() => {
                    resetAddDialog()
                    setAddDialogOpen(true)
                  }}
                >
                  <Plus className="size-4" aria-hidden />
                </Button>
              ) : null}
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">
                      {t('partner_programs.partnerTab.memberships.columns.program', 'Program')}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {t('partner_programs.partnerTab.memberships.columns.percent', '%')}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {t('partner_programs.partnerTab.memberships.columns.role', 'Role')}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {t('partner_programs.partnerTab.memberships.columns.joined', 'Joined')}
                    </th>
                    <th className="w-10 px-3 py-2 font-medium">
                      <span className="sr-only">
                        {t('partner_programs.partnerTab.memberships.columns.actions', 'Actions')}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {memberships.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-muted-foreground">
                        {t('partner_programs.partnerTab.memberships.empty', 'No memberships yet.')}
                      </td>
                    </tr>
                  ) : (
                    memberships.map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="px-3 py-2">{row.programName ?? row.programId ?? '—'}</td>
                        <td className="px-3 py-2">
                          {row.incentivePercent != null ? String(row.incentivePercent) : '—'}
                        </td>
                        <td className="px-3 py-2">{row.role ?? '—'}</td>
                        <td className="px-3 py-2">
                          {row.joinedAt ? new Date(row.joinedAt).toLocaleString() : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <RowActions
                            items={[
                              ...(row.programId
                                ? [
                                    {
                                      id: 'open-new-tab',
                                      label: t(
                                        'partner_programs.partnerTab.memberships.openInNewTab',
                                        'Open',
                                      ),
                                      onSelect: () =>
                                        window.open(
                                          programDetailHref(row.programId!),
                                          '_blank',
                                          'noopener,noreferrer',
                                        ),
                                    },
                                  ]
                                : []),
                              ...(canMembers
                                ? [
                                    {
                                      id: 'delete',
                                      label: t(
                                        'partner_programs.partnerTab.memberships.remove',
                                        'Remove',
                                      ),
                                      destructive: true as const,
                                      onSelect: () => void handleRemoveMembership(row),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">
                {t('partner_programs.partnerTab.ledger.title', 'Incentive ledger')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t(
                  'partner_programs.partnerTab.ledger.description',
                  'Accruals from referring orders and payouts.',
                )}
              </p>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">
                      {t('partner_programs.partnerTab.ledger.columns.date', 'Date')}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {t('partner_programs.partnerTab.ledger.columns.kind', 'Kind')}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {t('partner_programs.partnerTab.ledger.columns.order', 'Order')}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {t('partner_programs.partnerTab.ledger.columns.program', 'Program')}
                    </th>
                    <th className="px-3 py-2 font-medium text-right">
                      {t('partner_programs.partnerTab.ledger.columns.amount', 'Amount')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-4 text-muted-foreground">
                        {t('partner_programs.partnerTab.ledger.empty', 'No ledger entries yet.')}
                      </td>
                    </tr>
                  ) : (
                    ledger.map((row) => {
                      const orderLabel =
                        (typeof row.salesOrderNumber === 'string' && row.salesOrderNumber.trim().length
                          ? row.salesOrderNumber.trim()
                          : null) ??
                        (row.salesOrderId ? row.salesOrderId : null)
                      return (
                        <tr key={row.id} className="border-t">
                          <td className="px-3 py-2">
                            {row.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                          </td>
                          <td className="px-3 py-2 capitalize">
                            {row.kind === 'payout'
                              ? t('partner_programs.partnerTab.ledger.kindPayout', 'Payout')
                              : t('partner_programs.partnerTab.ledger.kindAccrual', 'Accrual')}
                          </td>
                          <td className="px-3 py-2">
                            {row.salesOrderId && orderLabel ? (
                              <Button asChild type="button" variant="outline" size="sm">
                                <Link
                                  href={orderDetailHref(row.salesOrderId)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2"
                                >
                                  <span className="font-medium">{orderLabel}</span>
                                  <ExternalLink className="size-4 shrink-0" aria-hidden />
                                  <span className="sr-only">{t('common.open', 'Open')}</span>
                                </Link>
                              </Button>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {row.programId ? (
                              <Button asChild type="button" variant="outline" size="sm">
                                <Link
                                  href={programDetailHref(row.programId)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2"
                                >
                                  <span className="font-medium">
                                    {row.programName?.trim() || row.programId}
                                  </span>
                                  <ExternalLink className="size-4 shrink-0" aria-hidden />
                                  <span className="sr-only">{t('common.open', 'Open')}</span>
                                </Link>
                              </Button>
                            ) : (
                              (row.programName ?? '—')
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatAmount(row.amount)} {row.currencyCode}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-4 rounded-md border p-4">
          <div>
            <h3 className="text-sm font-semibold">
              {t('partner_programs.partnerTab.balance.title', 'Balance')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t(
                'partner_programs.partnerTab.balance.description',
                'Totals are shown per currency.',
              )}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {t('partner_programs.partnerTab.balance.totalEarned', 'Total earned')}
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {balances.length === 0
                ? '—'
                : balances.length === 1
                  ? `${formatAmount(balances[0].totalEarned)} ${balances[0].currencyCode}`
                  : formatAmount(totalEarnedAll)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {t('partner_programs.partnerTab.balance.payable', 'Payable')}
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {balances.length === 0
                ? '—'
                : balances.length === 1
                  ? `${formatAmount(balances[0].payable)} ${balances[0].currencyCode}`
                  : formatAmount(payableAll)}
            </p>
          </div>
          {balances.length > 1 ? (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {balances.map((row) => (
                <li key={row.currencyCode} className="flex justify-between gap-2">
                  <span>{row.currencyCode}</span>
                  <span className="tabular-nums">
                    {formatAmount(row.payable)} / {formatAmount(row.totalEarned)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {canPayout ? (
            <div className="space-y-2 border-t pt-3">
              {balances.length > 1 ? (
                <div className="space-y-2">
                  <Label htmlFor="pp-payout-ccy">
                    {t('partner_programs.partnerTab.payout.currency', 'Currency')}
                  </Label>
                  <select
                    id="pp-payout-ccy"
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    value={payoutCurrency}
                    onChange={(ev) => setPayoutCurrency(ev.target.value)}
                  >
                    {balances.map((row) => (
                      <option key={row.currencyCode} value={row.currencyCode}>
                        {row.currencyCode} ({formatAmount(row.payable)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <Button
                type="button"
                className="inline-flex w-full items-center justify-center gap-2"
                disabled={
                  payingOut || !selectedBalance || !(selectedBalance.payable > 0)
                }
                onClick={() => void handlePayout()}
              >
                <HandCoins className="size-4 shrink-0" aria-hidden />
                {t('partner_programs.partnerTab.payout.action', 'Record payout')}
              </Button>
            </div>
          ) : null}
        </aside>
      </div>

      <Dialog
        open={addDialogOpen}
        onOpenChange={(open) => {
          setAddDialogOpen(open)
          if (!open) resetAddDialog()
        }}
      >
        <DialogContent className="sm:max-w-lg" onKeyDown={handleAddDialogKeyDown}>
          <DialogHeader>
            <DialogTitle>
              {t('partner_programs.partnerTab.memberships.dialogTitle', 'Add to program')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'partner_programs.partnerTab.memberships.dialogDescription',
                'Select a partner program and optionally set a role.',
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('partner_programs.partnerTab.memberships.program', 'Program')}</Label>
              <EntitySearchCombobox
                className="w-full"
                value={pickProgramId}
                onChange={setPickProgramId}
                options={[]}
                placeholder={t(
                  'partner_programs.partnerTab.memberships.programPlaceholder',
                  'Search programs…',
                )}
                onRemoteSearch={searchPrograms}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('partner_programs.partnerTab.memberships.role', 'Role')}</Label>
              <Input
                className={CRUD_FORM_TEXT_INPUT_CLASS}
                value={pickRole}
                onChange={(ev) => setPickRole(ev.target.value)}
                placeholder={t('partner_programs.partnerTab.memberships.roleOptional', 'Optional')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={adding}
              onClick={() => setAddDialogOpen(false)}
            >
              {t('partner_programs.partnerTab.memberships.dialogCancel', 'Cancel')}
            </Button>
            <Button
              type="button"
              disabled={adding || !pickProgramId}
              onClick={() => void handleAddMembership()}
            >
              {t('partner_programs.partnerTab.memberships.add', 'Add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
