"use client"

import * as React from 'react'
import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { INSURANCE_DESK_BASE } from '../../backend/insurance-desk/paths'

type LeadLite = {
  id: string
  title: string
  createdAt: string | null
}

export function LinkedLeadPreviewCard(props: { policyId: string }) {
  const t = useT()
  const { policyId } = props
  const [row, setRow] = React.useState<LeadLite | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const params = new URLSearchParams({
        linkedPolicyId: policyId,
        page: '1',
        pageSize: '1',
      })
      const call = await apiCall<{ items?: LeadLite[] }>(`/api/insurance/leads?${params.toString()}`)
      if (cancelled) return
      const item = call.result?.items?.[0]
      setRow(item && typeof item.id === 'string' ? item : null)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [policyId])

  if (!loading && !row) {
    return null
  }

  const href = row ? `${INSURANCE_DESK_BASE}/leads/${encodeURIComponent(row.id)}` : ''

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold leading-tight">
          {t('insurance_desk.policies.detail.linkedLead.title', 'Related inquiry')}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t(
            'insurance_desk.policies.detail.linkedLead.hint',
            'Inquiry linked to this policy (read-only preview).',
          )}
        </p>
      </div>
      <div className="rounded-md border border-dashed bg-muted/20 px-3 py-3 text-sm">
        {loading ? (
          <span className="text-muted-foreground">{t('common.loading', 'Loading…')}</span>
        ) : row ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-8">
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase text-muted-foreground">
                  {t('insurance_desk.leads.col.title', 'Inquiry subject')}
                </div>
                <div className="mt-0.5 truncate font-medium">{row.title.trim().length ? row.title : row.id}</div>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase text-muted-foreground">
                  {t('insurance_desk.leads.col.created', 'Received')}
                </div>
                <div className="mt-0.5 font-medium">
                  {row.createdAt
                    ? (() => {
                        const d = new Date(row.createdAt)
                        return Number.isNaN(d.getTime()) ? row.createdAt : d.toLocaleString()
                      })()
                    : '—'}
                </div>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" asChild className="shrink-0 self-start sm:self-center">
              <Link href={href} className="inline-flex items-center gap-2">
                <MessageSquare className="size-4 shrink-0" aria-hidden />
                {t('insurance_desk.policies.detail.linkedLead.open', 'Open')}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
