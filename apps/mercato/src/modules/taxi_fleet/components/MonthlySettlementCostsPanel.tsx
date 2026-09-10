'use client'

import * as React from 'react'
import Link from 'next/link'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { formatDateTime } from '@open-mercato/shared/lib/time'
import { CRUD_FORM_SELECT_CLASS, CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { TAXI_FLEET_BASE } from '../backend/taxi-fleet/paths'
import type { MonthlySettlementCostLine } from '../lib/monthlySettlementSnapshot'
import { useTaxiFleetLabels } from './useTaxiFleetLabels'
import { MonthlySettlementWeeklyLink } from './MonthlySettlementWeeklyLink'

type MonthlySettlementCostsPanelProps = {
  costs: MonthlySettlementCostLine[]
}

function formatMoney(value: number, currency = 'PLN'): string {
  if (!Number.isFinite(value)) return '—'
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

export function MonthlySettlementCostsPanel({ costs }: MonthlySettlementCostsPanelProps) {
  const t = useT()
  const { resolveCostTypeLabel } = useTaxiFleetLabels()
  const [search, setSearch] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState('all')

  const typeOptions = React.useMemo(() => {
    return [...new Set(costs.map((row) => row.costType).filter((value): value is string => Boolean(value)))].sort()
  }, [costs])

  const filteredCosts = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    return costs.filter((row) => {
      if (typeFilter !== 'all' && row.costType !== typeFilter) return false
      if (!query) return true
      const typeLabel = row.costType
        ? resolveCostTypeLabel(row.costType)
        : t('taxi_fleet.settlements.costs.unknown', 'Unknown')
      const haystack = [
        row.occurredAt ? formatDateTime(row.occurredAt) : '',
        typeLabel,
        row.documentNumber ?? '',
        row.notes ?? '',
        row.weekStart ?? '',
        row.tripId ?? '',
        String(row.amount),
        String(row.netAmount),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [costs, resolveCostTypeLabel, search, t, typeFilter])

  const totals = React.useMemo(
    () =>
      filteredCosts.reduce(
        (acc, row) => {
          acc.count += 1
          acc.gross += row.amount
          acc.net += row.netAmount
          return acc
        },
        { count: 0, gross: 0, net: 0 },
      ),
    [filteredCosts],
  )

  return (
    <section className="space-y-3 rounded-lg border bg-card px-4 py-3">
      <div>
        <h3 className="text-sm font-semibold">
          {t('taxi_fleet.monthlySettlements.costs.title', 'Costs')}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(
            'taxi_fleet.monthlySettlements.costs.hint',
            'Driver expenses included in this calendar month.',
          )}
        </p>
      </div>

      {costs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t(
            'taxi_fleet.monthlySettlements.costs.empty',
            'No costs in this monthly settlement snapshot. Recalculate if the month was generated before cost lines were stored.',
          )}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="monthly-costs-search">
                {t('taxi_fleet.monthlySettlements.filterSearch', 'Search')}
              </label>
              <input
                id="monthly-costs-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className={CRUD_FORM_TEXT_INPUT_CLASS}
                placeholder={t('taxi_fleet.monthlySettlements.costs.searchPlaceholder', 'Search costs…')}
              />
            </div>
            <div className="w-48 space-y-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="monthly-costs-type">
                {t('taxi_fleet.settlements.costs.line', 'Type')}
              </label>
              <select
                id="monthly-costs-type"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className={CRUD_FORM_SELECT_CLASS}
              >
                <option value="all">{t('taxi_fleet.monthlySettlements.filterAll', 'All')}</option>
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {resolveCostTypeLabel(type)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredCosts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('taxi_fleet.monthlySettlements.costs.noMatches', 'No costs match the current filters.')}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('taxi_fleet.settlements.ledger.date', 'Date')}</th>
                    <th className="px-3 py-2 font-medium">{t('taxi_fleet.settlements.costs.line', 'Type')}</th>
                    <th className="px-3 py-2 font-medium">
                      {t('taxi_fleet.financial.documentNumber', 'Document number')}
                    </th>
                    <th className="px-3 py-2 font-medium">{t('taxi_fleet.settlements.ledger.trip', 'Trip')}</th>
                    <th className="px-3 py-2 font-medium text-right">
                      {t('taxi_fleet.settlements.costs.gross', 'Gross')}
                    </th>
                    <th className="px-3 py-2 font-medium text-right">
                      {t('taxi_fleet.settlements.costs.net', 'Net')}
                    </th>
                    <th className="px-3 py-2 font-medium">
                      {t('taxi_fleet.monthlySettlements.weeklyLink.column', 'Weekly settlement')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCosts.map((row) => (
                    <tr key={row.id}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.occurredAt ? formatDateTime(row.occurredAt) : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {row.costType
                          ? resolveCostTypeLabel(row.costType)
                          : t('taxi_fleet.settlements.costs.unknown', 'Unknown')}
                      </td>
                      <td className="px-3 py-2">{row.documentNumber || '—'}</td>
                      <td className="px-3 py-2">
                        {row.tripId ? (
                          <Link
                            href={`${TAXI_FLEET_BASE}/trips/${encodeURIComponent(row.tripId)}`}
                            className="text-primary hover:underline"
                          >
                            {t('common.open', 'Open')}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatMoney(row.amount, row.currencyCode)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatMoney(row.netAmount, row.currencyCode)}
                      </td>
                      <td className="px-3 py-2">
                        <MonthlySettlementWeeklyLink
                          weeklySettlementId={row.weeklySettlementId}
                          weekStart={row.weekStart}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/30 font-semibold">
                    <td className="px-3 py-2" colSpan={4}>
                      {t('taxi_fleet.monthlySettlements.costs.total', 'Total')} ({totals.count})
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totals.gross)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totals.net)}</td>
                    <td className="px-3 py-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  )
}
