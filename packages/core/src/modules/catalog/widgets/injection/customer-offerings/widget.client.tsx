'use client'

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { Button } from '@open-mercato/ui/primitives/button'
import { Spinner } from '@open-mercato/ui/primitives/spinner'
import type { InjectionWidgetComponentProps } from '@open-mercato/shared/modules/widgets/injection'
import { flash } from '@open-mercato/ui/backend/FlashMessages'

type OfferingRow = {
  id: string
  productId: string
  productTitle: string
  salesOrderId: string
  parentOfferingId: string | null
  offeringKind: string
  status: string
  startsAt: string | null
  endsAt: string | null
  activatedAt: string | null
  spawnedCaseCount: number
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

export default function CustomerOfferingsWidget({
  context,
  data,
}: InjectionWidgetComponentProps) {
  const t = useT()
  const customerEntityId = React.useMemo(
    () => resolveCustomerEntityId(data, (context ?? {}) as Record<string, unknown>),
    [context, data],
  )
  const [items, setItems] = React.useState<OfferingRow[]>([])
  const [loading, setLoading] = React.useState(false)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!customerEntityId) return
    setLoading(true)
    setError(null)
    try {
      const { ok, result } = await apiCall<{ items?: OfferingRow[] }>(
        `/api/catalog/customer-offerings?customerEntityId=${encodeURIComponent(customerEntityId)}`,
      )
      if (!ok) {
        setError(t('catalog.customerOfferings.errors.load', 'Failed to load offerings.'))
        setItems([])
        return
      }
      setItems(Array.isArray(result?.items) ? result.items : [])
    } catch {
      setError(t('catalog.customerOfferings.errors.load', 'Failed to load offerings.'))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [customerEntityId, t])

  React.useEffect(() => {
    void load()
  }, [load])

  const activate = React.useCallback(
    async (offeringId: string) => {
      setBusyId(offeringId)
      try {
        const { ok, result } = await apiCall<{ error?: string }>(
          '/api/catalog/customer-offerings/activate',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ offeringId, force: true }),
          },
        )
        if (!ok) {
          flash(
            typeof result?.error === 'string'
              ? result.error
              : t('catalog.customerOfferings.errors.activate', 'Failed to activate offering.'),
            'error',
          )
          return
        }
        flash(t('catalog.customerOfferings.activateSuccess', 'Offering activated.'), 'success')
        await load()
      } finally {
        setBusyId(null)
      }
    },
    [load, t],
  )

  const deactivate = React.useCallback(
    async (offeringId: string) => {
      setBusyId(offeringId)
      try {
        const { ok, result } = await apiCall<{ error?: string }>(
          '/api/catalog/customer-offerings/deactivate',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ offeringId }),
          },
        )
        if (!ok) {
          flash(
            typeof result?.error === 'string'
              ? result.error
              : t('catalog.customerOfferings.errors.deactivate', 'Failed to deactivate offering.'),
            'error',
          )
          return
        }
        flash(t('catalog.customerOfferings.deactivateSuccess', 'Offering deactivated.'), 'success')
        await load()
      } finally {
        setBusyId(null)
      }
    },
    [load, t],
  )

  if (!customerEntityId) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('catalog.customerOfferings.emptyCustomer', 'Customer context is missing.')}
      </p>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Spinner className="h-4 w-4" />
        {t('catalog.customerOfferings.loading', 'Loading offerings…')}
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-3 py-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          {t('catalog.customerOfferings.retry', 'Retry')}
        </Button>
      </div>
    )
  }

  if (!items.length) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        {t('catalog.customerOfferings.empty', 'No product offerings for this customer yet.')}
      </p>
    )
  }

  return (
    <div className="space-y-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t('catalog.customerOfferings.description', 'Offerings created from confirmed sales orders.')}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          {t('catalog.customerOfferings.refresh', 'Refresh')}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">
                {t('catalog.customerOfferings.columns.product', 'Product')}
              </th>
              <th className="px-3 py-2 font-medium">
                {t('catalog.customerOfferings.columns.kind', 'Kind')}
              </th>
              <th className="px-3 py-2 font-medium">
                {t('catalog.customerOfferings.columns.status', 'Status')}
              </th>
              <th className="px-3 py-2 font-medium">
                {t('catalog.customerOfferings.columns.window', 'Window')}
              </th>
              <th className="px-3 py-2 font-medium">
                {t('catalog.customerOfferings.columns.cases', 'Cases')}
              </th>
              <th className="px-3 py-2 font-medium">
                {t('catalog.customerOfferings.columns.actions', 'Actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const canActivate = item.status === 'pending'
              const canDeactivate = item.status === 'active' || item.status === 'pending'
              return (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2">
                    <div className="font-medium">{item.productTitle}</div>
                    {item.parentOfferingId ? (
                      <div className="text-xs text-muted-foreground">
                        {t('catalog.customerOfferings.childOfBundle', 'Bundle component')}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{item.offeringKind}</td>
                  <td className="px-3 py-2">{item.status}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {item.startsAt || item.endsAt
                      ? `${item.startsAt ?? '—'} → ${item.endsAt ?? '—'}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2">{item.spawnedCaseCount}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      {canActivate ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={busyId === item.id}
                          onClick={() => void activate(item.id)}
                        >
                          {t('catalog.customerOfferings.activate', 'Activate')}
                        </Button>
                      ) : null}
                      {canDeactivate ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busyId === item.id}
                          onClick={() => void deactivate(item.id)}
                        >
                          {t('catalog.customerOfferings.deactivate', 'Deactivate')}
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
