"use client"

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type SignalRow = {
  id: string
  signalType: string
  source: string
  occurredAt: string
}

type ListJson = {
  items?: SignalRow[]
  total?: number
}

type InjectionContext = {
  resourceId?: string
  recordId?: string
  companyId?: string
}

export default function CustomerSignalsWidget({ context }: { context?: InjectionContext }) {
  const t = useT()
  const customerEntityId =
    context?.resourceId ?? context?.recordId ?? context?.companyId ?? undefined

  const { data, isLoading, isError } = useQuery({
    queryKey: ['customer-signals-panel', customerEntityId],
    queryFn: async (): Promise<SignalRow[]> => {
      if (!customerEntityId) return []
      const params = new URLSearchParams({
        customerEntityId,
        page: '1',
        pageSize: '25',
      })
      const result = await apiCall<ListJson>(`/api/customer_signals/signals?${params.toString()}`)
      if (!result.ok) throw new Error('load failed')
      return Array.isArray(result.result?.items) ? result.result.items : []
    },
    enabled: typeof customerEntityId === 'string' && customerEntityId.length > 0,
  })

  if (!customerEntityId) {
    return null
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</div>
  }

  if (isError) {
    return <div className="text-sm text-destructive">{t('customer_signals.widgets.loadError', 'Could not load signals.')}</div>
  }

  const rows = data ?? []

  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 text-sm font-medium">{t('customer_signals.widgets.panelTitle', 'Behavior signals')}</div>
      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">{t('customer_signals.widgets.empty', 'No signals recorded for this customer.')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1 pr-2">{t('customer_signals.widgets.columns.type', 'Type')}</th>
                <th className="py-1 pr-2">{t('customer_signals.widgets.columns.source', 'Source')}</th>
                <th className="py-1">{t('customer_signals.widgets.columns.time', 'Time')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="py-1.5 pr-2 font-mono text-xs">{row.signalType}</td>
                  <td className="py-1.5 pr-2">{row.source}</td>
                  <td className="py-1.5 text-muted-foreground text-xs">{row.occurredAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
