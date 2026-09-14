'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { TAXI_FLEET_BASE } from '../../backend/taxi-fleet/paths'
import { SettlementStatusBadge } from '../SettlementStatusBadge'
import { useResourceLabels } from '../useResourceLabels'
import { computeCashVariance } from '../../lib/settlementCashVariance'
import { formatSettlementMoney } from '../../lib/settlementPayoutDisplay'

type Row = {
  id: string
  resourceId: string
  monthStart: string
  status: string
  cashExpected?: string
  cashReported?: string
}

type ListResponse = { items: Row[]; total?: number }

export function VehicleSettlementsHubSection() {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const [rows, setRows] = React.useState<Row[]>([])
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const params = new URLSearchParams({
        page: '1',
        pageSize: '5',
        sortField: 'monthStart',
        sortDir: 'desc',
      })
      const call = await apiCall<ListResponse>(`/api/taxi_fleet/vehicle-monthly-settlements?${params}`)
      if (cancelled) return
      setRows(Array.isArray(call.result?.items) ? call.result.items : [])
      setTotal(call.result?.total ?? call.result?.items?.length ?? 0)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [scopeVersion])

  const resourceIds = React.useMemo(
    () => [...new Set(rows.map((row) => row.resourceId).filter(Boolean))],
    [rows],
  )
  const { resolveLabel } = useResourceLabels(resourceIds)

  return (
    <section className="rounded-lg border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">
            {t('taxi_fleet.settlements.vehicles.monthlyTitle', 'Monthly vehicle settlements')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'taxi_fleet.settlements.vehicles.monthlyHelp',
              'End-of-month vehicle FRE with GPS distance and cash register checks.',
            )}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={`${TAXI_FLEET_BASE}/settlements-overview/vehicles`}>
            {t('taxi_fleet.hub.vehicleSettlements.open', 'Open vehicle settlements')}
            <ArrowRight className="ml-1 size-4" aria-hidden />
          </Link>
        </Button>
      </div>
      <div className="mt-4 space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('taxi_fleet.hub.loading', 'Loading…')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('taxi_fleet.hub.vehicleSettlements.empty', 'No vehicle monthly settlements yet.')}
          </p>
        ) : (
          rows.map((row) => {
            const variance = computeCashVariance(
              Number(row.cashReported ?? 0),
              Number(row.cashExpected ?? 0),
            )
            return (
              <Link
                key={row.id}
                href={`${TAXI_FLEET_BASE}/vehicle-monthly-settlements/${encodeURIComponent(row.id)}`}
                className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{resolveLabel(row.resourceId)}</div>
                  <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                    {row.monthStart.slice(0, 7)} · {formatSettlementMoney(variance)}
                  </div>
                </div>
                <SettlementStatusBadge status={row.status} />
              </Link>
            )
          })
        )}
      </div>
      {!loading && total > rows.length ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {t('taxi_fleet.hub.pendingTrips.more', '+{count} more', { count: String(total - rows.length) })}
        </p>
      ) : null}
    </section>
  )
}
