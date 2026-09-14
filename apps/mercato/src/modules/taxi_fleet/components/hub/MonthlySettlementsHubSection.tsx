'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { TAXI_FLEET_BASE } from '../../backend/taxi-fleet/paths'
import { formatMonthLabel } from '../../lib/weekUtils'
import { SettlementStatusBadge } from '../SettlementStatusBadge'
import { useFleetDriverDirectory } from '../useFleetDriverDirectory'

type SettlementRow = {
  id: string
  teamMemberId: string
  monthStart: string
  status: string
}

type ListResponse = { items: SettlementRow[]; total?: number }

export function MonthlySettlementsHubSection() {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const { resolveName } = useFleetDriverDirectory()
  const [rows, setRows] = React.useState<SettlementRow[]>([])
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
      const call = await apiCall<ListResponse>(`/api/taxi_fleet/monthly-settlements?${params}`)
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

  return (
    <section className="rounded-lg border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{t('taxi_fleet.monthlySettlements.title', 'Monthly settlements')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('taxi_fleet.hub.monthlySettlementsHelp', 'Per-driver monthly settlements used for payout.')}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={`${TAXI_FLEET_BASE}/settlements-overview/monthly`}>
            {t('taxi_fleet.hub.monthlySettlements.open', 'Open monthly settlements')}
            <ArrowRight className="ml-1 size-4" aria-hidden />
          </Link>
        </Button>
      </div>
      <div className="mt-4 space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('taxi_fleet.hub.loading', 'Loading…')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('taxi_fleet.hub.monthlySettlements.empty', 'No monthly settlements yet.')}
          </p>
        ) : (
          rows.map((row) => (
            <Link
              key={row.id}
              href={`${TAXI_FLEET_BASE}/monthly-settlements/${encodeURIComponent(row.id)}`}
              className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2 transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{resolveName(row.teamMemberId)}</div>
                <div className="mt-1 text-xs text-muted-foreground tabular-nums">{formatMonthLabel(row.monthStart)}</div>
              </div>
              <SettlementStatusBadge status={row.status} />
            </Link>
          ))
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
