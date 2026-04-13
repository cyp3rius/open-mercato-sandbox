"use client"

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { LeadVehiclePreview, PreviewFieldCell, PreviewFieldGrid } from '../leads/leadDetailPreviewUtils'
import {
  deriveNewResourceNameForApi,
  emptyInsuranceSubjectValue,
  type InsuranceSubjectFormValue,
} from './PolicySubjectField'

function normalize(raw: unknown): InsuranceSubjectFormValue {
  const base = emptyInsuranceSubjectValue()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  if (o.mode === 'new_resource' || o.mode === 'existing') base.mode = o.mode
  if (typeof o.resourceId === 'string') base.resourceId = o.resourceId
  if (typeof o.newResourceName === 'string') base.newResourceName = o.newResourceName
  if (typeof o.newResourceDescription === 'string') base.newResourceDescription = o.newResourceDescription
  const v = o.vehicle
  if (v && typeof v === 'object') {
    const vo = v as Record<string, unknown>
    for (const k of Object.keys(base.vehicle) as (keyof InsuranceSubjectFormValue['vehicle'])[]) {
      if (typeof vo[k] === 'string') base.vehicle[k] = vo[k]
    }
  }
  return base
}

function shortId(value: string, len = 12) {
  const s = value.trim()
  if (!s.length) return ''
  return s.length > len ? `${s.slice(0, len)}…` : s
}

export function PolicySubjectDetailPreview({
  insuranceSubject,
  t,
  policyResourceId,
  resourceDisplayName,
}: {
  insuranceSubject: unknown
  t: TranslateFn
  /** Policy row `resource_id` when form subject has not yet mirrored it. */
  policyResourceId?: string | null
  resourceDisplayName?: string | null
}) {
  const s = normalize(insuranceSubject)
  const rid = s.resourceId.trim() || (typeof policyResourceId === 'string' ? policyResourceId.trim() : '')
  const displayName =
    resourceDisplayName && resourceDisplayName.trim().length
      ? resourceDisplayName.trim()
      : rid.length
        ? shortId(rid)
        : ''

  const resourceHref = rid.length ? `/backend/resources/resources/${encodeURIComponent(rid)}` : ''
  const showOpenResource = resourceHref.length > 0

  let resourceValue: ReactNode = null
  if (s.mode === 'new_resource') {
    const draft = deriveNewResourceNameForApi(s)
    resourceValue = draft.length
      ? draft
      : t(
          'insurance_desk.policies.detail.subject.newResourcePending',
          'New resource (save policy to create)',
        )
  } else if (rid.length) {
    resourceValue = <span className="font-medium text-foreground">{displayName}</span>
  }

  return (
    <div className="relative">
      {showOpenResource ? (
        <Button type="button" variant="outline" size="sm" asChild className="absolute end-0 top-0 z-10 shrink-0">
          <Link
            href={resourceHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2"
          >
            <ExternalLink className="size-4 shrink-0" aria-hidden />
            {t('common.open', 'Open')}
          </Link>
        </Button>
      ) : null}
      <div className={showOpenResource ? 'space-y-4 pe-28' : 'space-y-4'}>
        <PreviewFieldGrid className="sm:grid-cols-1">
          <PreviewFieldCell
            label={t('insurance_desk.policies.form.subject.pickResource', 'Resource')}
            value={resourceValue}
          />
        </PreviewFieldGrid>
        <LeadVehiclePreview leadVehicle={s.vehicle} t={t} />
      </div>
    </div>
  )
}
