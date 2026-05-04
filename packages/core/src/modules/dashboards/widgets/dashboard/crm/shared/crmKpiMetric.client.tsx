"use client"

import * as React from 'react'
import Link from 'next/link'
import type { DashboardWidgetComponentProps } from '@open-mercato/shared/modules/dashboard/widgets'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { KpiCard } from '@open-mercato/ui/backend/charts'
import { DEFAULT_CRM_KPI_SETTINGS, type CrmKpiMetricKey, type CrmKpiSettings, hydrateCrmKpiSettings } from './config'

type KpiResponse = {
  overdueResourceTasks: number | null
  openCasesSla: number | null
  qcPending: number | null
  fetchedAt: string
}

const VALUE_KEY: Record<CrmKpiMetricKey, keyof KpiResponse> = {
  overdueResourceTasks: 'overdueResourceTasks',
  openCasesSla: 'openCasesSla',
  qcPending: 'qcPending',
}

export function CrmKpiMetricWidgetClient({
  mode,
  settings = DEFAULT_CRM_KPI_SETTINGS,
  metricKey,
  titleKey,
  titleFallback,
  linkHref,
  linkLabelKey,
  linkLabelFallback,
  refreshToken,
  onRefreshStateChange,
}: DashboardWidgetComponentProps<CrmKpiSettings> & {
  metricKey: CrmKpiMetricKey
  titleKey: string
  titleFallback: string
  linkHref: string
  linkLabelKey: string
  linkLabelFallback: string
}) {
  const t = useT()
  const hydrated = React.useMemo(() => hydrateCrmKpiSettings(settings), [settings])
  const [value, setValue] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    onRefreshStateChange?.(true)
    setLoading(true)
    setError(null)
    try {
      const call = await apiCall<KpiResponse>('/api/dashboards/crm/kpis')
      if (!call.ok) {
        setError(t('dashboards.crm.kpisError', 'Failed to load KPIs.'))
        setValue(null)
        return
      }
      const key = VALUE_KEY[metricKey]
      const raw = call.result?.[key]
      setValue(typeof raw === 'number' ? raw : null)
    } catch {
      setError(t('dashboards.crm.kpisError', 'Failed to load KPIs.'))
      setValue(null)
    } finally {
      setLoading(false)
      onRefreshStateChange?.(false)
    }
  }, [metricKey, onRefreshStateChange, t])

  React.useEffect(() => {
    void refresh()
  }, [refresh, refreshToken, hydrated])

  if (mode === 'settings') {
    return <p className="text-sm text-muted-foreground">{t('dashboards.crm.noSettings', 'No settings for this card.')}</p>
  }

  return (
    <div className="space-y-2">
      <KpiCard
        title={t(titleKey, titleFallback)}
        value={value}
        loading={loading}
        error={error}
      />
      <Link className="text-sm text-primary underline" href={linkHref}>
        {t(linkLabelKey, linkLabelFallback)}
      </Link>
    </div>
  )
}
