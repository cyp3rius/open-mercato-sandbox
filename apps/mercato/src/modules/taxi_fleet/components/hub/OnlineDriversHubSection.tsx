'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { TAXI_FLEET_BASE } from '../../backend/taxi-fleet/paths'
import { useFleetDriverDirectory } from '../useFleetDriverDirectory'
import { useResourceLabels } from '../useResourceLabels'

type DriverProfileRow = {
  id: string
  teamMemberId: string
  defaultResourceId?: string | null
  defaultResourceIds?: string[] | null
  onShift?: boolean
}

type ListResponse = { items: DriverProfileRow[]; total?: number }

function resolveDefaultResourceId(row: DriverProfileRow): string | null {
  if (typeof row.defaultResourceId === 'string' && row.defaultResourceId.trim()) {
    return row.defaultResourceId.trim()
  }
  const fromList = Array.isArray(row.defaultResourceIds)
    ? row.defaultResourceIds.find((id) => typeof id === 'string' && id.trim())
    : null
  return fromList?.trim() || null
}

export function OnlineDriversHubSection() {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const { resolveName } = useFleetDriverDirectory()
  const [rows, setRows] = React.useState<DriverProfileRow[]>([])
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const params = new URLSearchParams({
        page: '1',
        pageSize: '8',
        onShift: 'true',
      })
      const call = await apiCall<ListResponse>(`/api/taxi_fleet/driver-profiles?${params}`)
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

  const resourceIds = React.useMemo(() => {
    const ids = new Set<string>()
    for (const row of rows) {
      const resourceId = resolveDefaultResourceId(row)
      if (resourceId) ids.add(resourceId)
    }
    return [...ids]
  }, [rows])
  const { resolveLabel: resolveResourceLabel } = useResourceLabels(resourceIds)

  return (
    <section className="rounded-lg border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{t('taxi_fleet.drivers.title', 'Driver profiles')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('taxi_fleet.hub.onlineDrivers.description', 'Drivers currently on shift.')}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={`${TAXI_FLEET_BASE}/drivers`}>
            {t('taxi_fleet.hub.drivers.open', 'Open driver profiles')}
            <ArrowRight className="ml-1 size-4" aria-hidden />
          </Link>
        </Button>
      </div>
      <div className="mt-4 space-y-2">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('taxi_fleet.hub.loading', 'Loading…')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('taxi_fleet.hub.onlineDrivers.empty', 'No drivers currently on shift.')}
          </p>
        ) : (
          rows.map((row) => {
            const resourceId = resolveDefaultResourceId(row)
            const resourceLabel = resourceId ? resolveResourceLabel(resourceId) : null
            return (
              <Link
                key={row.id}
                href={`${TAXI_FLEET_BASE}/drivers/${encodeURIComponent(row.id)}`}
                className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2 transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{resolveName(row.teamMemberId)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {resourceLabel ||
                      t('taxi_fleet.hub.onlineDrivers.noVehicle', 'No default vehicle')}
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                  <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
                  {t('taxi_fleet.drivers.list.filters.onShiftYes', 'On shift')}
                </span>
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
