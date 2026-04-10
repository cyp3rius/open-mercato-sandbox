"use client"

import * as React from 'react'
import { Badge } from '@open-mercato/ui/primitives/badge'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { cn } from '@open-mercato/shared/lib/utils'
import { ProtectionCatalogLucideIcon } from '../../lib/catalogLucideIcon'
import { normalizeCoveragesValue } from './PolicyCoveragesField'
import {
  formatDetailValue,
  PreviewFieldCell,
  PreviewFieldGrid,
  resolveCoverageKey,
  type ProtectionCatalog,
} from '../leads/leadDetailPreviewUtils'

function PreviewEmpty({ label }: { label: string }) {
  return <p className="text-sm text-muted-foreground">{label}</p>
}

/**
 * Policy detail: coverage scope as stacked badges (like inquiries), with optional
 * policy-line sums and catalog additional fields in a 3-column label/value grid under each badge.
 */
export function PolicyCoverageScopeDetailPreview({
  coverages,
  coverageSubSelections,
  coverageDetailValues,
}: {
  coverages: unknown
  coverageSubSelections: Record<string, string>
  coverageDetailValues: Record<string, Record<string, unknown>>
}) {
  const t = useT()
  const [catalog, setCatalog] = React.useState<ProtectionCatalog | null>(null)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      const call = await apiCall<ProtectionCatalog>('/api/insurance/config-protection-catalog')
      if (cancelled) return
      if (!call.ok || !call.result?.options) {
        setLoadError(t('insurance_desk.leads.coverage.catalogError', 'Could not load protection catalog.'))
        setCatalog(null)
        return
      }
      setLoadError(null)
      setCatalog(call.result)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [t])

  const cov = normalizeCoveragesValue(coverages)

  if (loadError || !catalog) {
    return <p className="text-sm text-muted-foreground">{loadError ?? t('common.loading', 'Loading…')}</p>
  }

  const blocks: { key: string; content: React.ReactNode }[] = []

  for (const entry of catalog.options) {
    const covKey = resolveCoverageKey(entry)
    if (!covKey) continue
    const line = cov[covKey]
    if (!line?.enabled) continue

    const subVal = coverageSubSelections[entry.value]
    const subName = entry.additionalOptions.find((o) => o.value === subVal)?.name
    const detailStore = coverageDetailValues[entry.value] ?? {}

    const policyRows: { label: string; value: string }[] = []
    const sum = line.sumInsured.trim()
    const ded = line.deductible.trim()
    const notes = line.notes.trim()
    if (sum.length) {
      policyRows.push({
        label: t('insurance_desk.policies.form.coverages.sumInsured', 'Sum insured'),
        value: sum,
      })
    }
    if (ded.length) {
      policyRows.push({
        label: t('insurance_desk.policies.form.coverages.deductible', 'Deductible'),
        value: ded,
      })
    }
    if (notes.length) {
      policyRows.push({
        label: t('insurance_desk.policies.form.coverages.notes', 'Notes'),
        value: notes,
      })
    }

    const catalogRows: { label: string; value: string }[] = []
    for (const f of entry.fields) {
      const formatted = formatDetailValue(f, detailStore[f.propertyKey], t)
      if (formatted) catalogRows.push({ label: f.label, value: formatted })
    }

    const hasSub = Boolean(subName?.trim().length)
    const hasGrid = policyRows.length > 0 || catalogRows.length > 0

    blocks.push({
      key: entry.value,
      content: (
        <div className="space-y-3">
          <Badge
            variant="secondary"
            className={cn(
              'h-auto gap-2 border border-transparent px-3.5 py-1.5 text-sm font-medium leading-snug rounded-2xl w-fit max-w-full',
            )}
          >
            <ProtectionCatalogLucideIcon name={entry.icon} className="size-4 shrink-0" />
            <span>{entry.label}</span>
          </Badge>

          {hasSub ? (
            <div className="flex min-w-0 max-w-full flex-wrap items-center gap-x-1.5 gap-y-0 text-sm">
              {entry.additionalOptionsLabel?.trim().length ? (
                <span className="shrink-0 font-semibold text-muted-foreground">{entry.additionalOptionsLabel}</span>
              ) : null}
              <span className="min-w-0 font-medium text-foreground">{subName}</span>
            </div>
          ) : null}

          {hasGrid ? (
            <PreviewFieldGrid>
              {policyRows.map((row) => (
                <PreviewFieldCell key={`p-${row.label}`} label={row.label} value={row.value} />
              ))}
              {catalogRows.map((row) => (
                <PreviewFieldCell key={`c-${row.label}`} label={row.label} value={row.value} />
              ))}
            </PreviewFieldGrid>
          ) : null}
        </div>
      ),
    })
  }

  if (!blocks.length) {
    return <PreviewEmpty label={t('insurance_desk.leads.detail.previewEmpty', 'No data.')} />
  }

  return (
    <div className="flex flex-col">
      {blocks.map((block, index) => (
        <div
          key={block.key}
          className={cn(index > 0 && 'mt-6 border-t border-border pt-6')}
        >
          {block.content}
        </div>
      ))}
    </div>
  )
}
