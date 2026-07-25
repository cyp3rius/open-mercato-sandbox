'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { LoadingMessage, TabEmptyState } from '@open-mercato/ui/backend/detail'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import {
  buildPolicyCreateHref,
  type CustomerCreatePrefillInput,
} from './customerEntityCreatePrefill'
import { DetailTabAddToolbar } from './DetailTabAddToolbar'

const PAGE_SIZE = 50

type PolicyRow = {
  id: string
  policyNumber?: string | null
  status?: string | null
  validFrom?: string | null
  validTo?: string | null
}

export type CustomerEntityPoliciesTabProps = {
  customerEntityId: string
  ownerUserId?: string | null
  kind: CustomerCreatePrefillInput['kind']
  addActionLabel: string
  emptyState: { title: string; actionLabel: string }
}

export function CustomerEntityPoliciesTab({
  customerEntityId,
  ownerUserId,
  kind,
  addActionLabel,
  emptyState,
}: CustomerEntityPoliciesTabProps) {
  const t = useT()
  const router = useRouter()
  const scopeVersion = useOrganizationScopeVersion()
  const [rows, setRows] = React.useState<PolicyRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const createHref = React.useMemo(
    () => buildPolicyCreateHref({ customerEntityId, ownerUserId, kind }),
    [customerEntityId, kind, ownerUserId],
  )

  const openCreate = React.useCallback(() => {
    router.push(createHref)
  }, [createHref, router])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams({
          page: '1',
          pageSize: String(PAGE_SIZE),
          customerEntityId,
          sortField: 'updatedAt',
          sortDir: 'desc',
        })
        const call = await apiCall<{ items?: PolicyRow[] }>(`/api/insurance/policies?${params.toString()}`)
        if (cancelled) return
        if (!call.ok) {
          setError(t('customers.detail.linked.policies.loadError', 'Failed to load policies.'))
          setRows([])
          return
        }
        setRows(Array.isArray(call.result?.items) ? call.result.items : [])
      } catch {
        if (!cancelled) {
          setError(t('customers.detail.linked.policies.loadError', 'Failed to load policies.'))
          setRows([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [customerEntityId, scopeVersion, t])

  if (loading) {
    return <LoadingMessage label={t('customers.detail.linked.policies.loading', 'Loading policies…')} />
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!rows.length) {
    return (
      <TabEmptyState
        title={emptyState.title}
        actionLabel={emptyState.actionLabel}
        onAction={openCreate}
      />
    )
  }

  return (
    <div className="space-y-3">
      <DetailTabAddToolbar label={addActionLabel} onClick={openCreate} />
      <ul className="divide-y rounded-md border">
        {rows.map((row) => {
          const number =
            typeof row.policyNumber === 'string' && row.policyNumber.trim() ? row.policyNumber : row.id
          return (
            <li key={row.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-muted/40"
                onClick={() =>
                  router.push(`/backend/insurance-desk/policies/${encodeURIComponent(row.id)}`)
                }
              >
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-foreground">{number}</span>
                  {row.validFrom || row.validTo ? (
                    <span className="ml-2 text-muted-foreground">
                      {[row.validFrom?.slice(0, 10), row.validTo?.slice(0, 10)].filter(Boolean).join(' → ')}
                    </span>
                  ) : null}
                </span>
                {row.status ? (
                  <span className="shrink-0 text-xs text-muted-foreground">{row.status}</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
