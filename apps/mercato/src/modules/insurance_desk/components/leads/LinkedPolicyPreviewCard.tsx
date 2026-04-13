"use client"

import * as React from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { renderDictionaryIcon } from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'
import { INSURANCE_DESK_BASE } from '../../backend/insurance-desk/paths'
import type { PolicyApiRow } from '../../lib/policyDuplicatePrefill'
import { PreviewFieldCell, PreviewFieldGrid } from './leadDetailPreviewUtils'

type InsurerLite = { id: string; code: string; name: string }
type ContactLite = { id: string; fullName: string }

function formatIsoDate(iso: string | null): string {
  if (!iso?.length) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString()
}

export function LinkedPolicyPreviewCard(props: { policyId: string }) {
  const t = useT()
  const { policyId } = props
  const [row, setRow] = React.useState<PolicyApiRow | null>(null)
  const [insurerLabel, setInsurerLabel] = React.useState<string>('—')
  const [contactLabel, setContactLabel] = React.useState<string>('—')
  const [statusDisplay, setStatusDisplay] = React.useState<{
    label: string
    icon?: string
    color?: string
  } | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const call = await apiCall<{ items?: PolicyApiRow[] }>(
        `/api/insurance/policies?id=${encodeURIComponent(policyId)}&page=1&pageSize=1`,
      )
      if (cancelled) return
      const item = call.result?.items?.[0]
      if (!item || typeof item.id !== 'string') {
        setRow(null)
        setLoading(false)
        return
      }
      setRow(item)

      const [stCall, insCall] = await Promise.all([
        apiCall<{ entries?: Array<{ value: string; label: string; icon?: string; color?: string }> }>(
          '/api/insurance/config-policy-status',
        ),
        apiCall<{ items?: InsurerLite[] }>(
          `/api/insurance/insurers?id=${encodeURIComponent(item.insurerId)}&page=1&pageSize=1`,
        ),
      ])
      if (cancelled) return

      const statusRaw = typeof item.status === 'string' ? item.status.trim() : ''
      if (statusRaw.length) {
        const entries = Array.isArray(stCall.result?.entries) ? stCall.result.entries : []
        const hit = entries.find((e) => e.value.trim() === statusRaw)
        setStatusDisplay(
          hit
            ? {
                label: hit.label.trim(),
                icon: hit.icon?.trim(),
                color: hit.color?.trim(),
              }
            : { label: statusRaw },
        )
      } else {
        setStatusDisplay(null)
      }

      const insItem = insCall.result?.items?.[0]
      setInsurerLabel(
        insItem ? `${insItem.code} — ${insItem.name}` : item.insurerId,
      )

      const cid = item.insurerContactId?.trim()
      if (cid) {
        const cCall = await apiCall<{ items?: ContactLite[] }>(
          `/api/insurance/insurer-contacts?id=${encodeURIComponent(cid)}&page=1&pageSize=1`,
        )
        if (cancelled) return
        const c = cCall.result?.items?.[0]
        setContactLabel(c?.fullName?.trim().length ? c.fullName.trim() : cid)
      } else {
        setContactLabel('—')
      }

      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [policyId])

  const href = `${INSURANCE_DESK_BASE}/policies/${encodeURIComponent(policyId)}`

  const statusValue =
    statusDisplay != null ? (
      <span className="inline-flex items-center gap-2">
        {statusDisplay.icon ? (
          <span className="shrink-0 text-muted-foreground">
            {renderDictionaryIcon(statusDisplay.icon, 'h-4 w-4')}
          </span>
        ) : null}
        {statusDisplay.color ? (
          <span
            className="inline-block size-2.5 shrink-0 rounded-full border border-border"
            style={{ backgroundColor: statusDisplay.color }}
          />
        ) : null}
        <span>{statusDisplay.label}</span>
      </span>
    ) : (
      '—'
    )

  return (
    <section className="space-y-3 rounded-lg border bg-card px-4 py-3">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold leading-tight">
          {t('insurance_desk.leads.detail.linkedPolicy.title', 'Linked policy')}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t(
            'insurance_desk.leads.detail.linkedPolicy.hint',
            'This inquiry is linked to a policy. Editing the inquiry is disabled until the link is removed (e.g. if the policy is deleted).',
          )}
        </p>
      </div>
      <div className="rounded-md border border-dashed bg-muted/20 px-3 py-3 text-sm">
        {loading ? (
          <span className="text-muted-foreground">{t('common.loading', 'Loading…')}</span>
        ) : row ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-4">
              <PreviewFieldCell
                label={t('insurance_desk.policies.col.number', 'Policy number')}
                value={row.policyNumber}
              />
              <Button type="button" variant="outline" size="sm" asChild className="shrink-0">
                <Link
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2"
                >
                  <ExternalLink className="size-4 shrink-0" aria-hidden />
                  {t('insurance_desk.leads.openPolicy', 'Open')}
                </Link>
              </Button>
            </div>
            <PreviewFieldGrid>
              <PreviewFieldCell
                label={t('insurance_desk.policies.col.status', 'Status')}
                value={statusValue}
              />
              <PreviewFieldCell
                label={t('insurance_desk.policies.col.insurer', 'Insurer')}
                value={insurerLabel}
              />
              <PreviewFieldCell
                label={t('insurance_desk.policies.form.insurerContact', 'Insurer contact')}
                value={contactLabel}
              />
              <PreviewFieldCell
                label={t('insurance_desk.policies.col.validFrom', 'Valid from')}
                value={formatIsoDate(row.validFrom)}
              />
              <PreviewFieldCell
                label={t('insurance_desk.policies.col.validTo', 'Valid to')}
                value={formatIsoDate(row.validTo)}
              />
            </PreviewFieldGrid>
          </div>
        ) : (
          <span className="text-muted-foreground">
            {t('insurance_desk.leads.detail.linkedPolicy.notFound', 'Policy could not be loaded.')}
          </span>
        )}
      </div>
    </section>
  )
}
