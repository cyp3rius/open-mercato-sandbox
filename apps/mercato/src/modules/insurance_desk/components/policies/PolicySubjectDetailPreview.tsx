"use client"

import type { ReactNode } from 'react'
import Link from 'next/link'
import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
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
    resourceValue = (
      <Link
        href={`/backend/resources/resources/${encodeURIComponent(rid)}`}
        className="font-medium text-primary hover:underline"
      >
        {displayName}
      </Link>
    )
  }

  return (
    <div className="space-y-4">
      <PreviewFieldGrid className="sm:grid-cols-1">
        <PreviewFieldCell
          label={t('insurance_desk.policies.form.subject.pickResource', 'Resource')}
          value={resourceValue}
        />
      </PreviewFieldGrid>
      <LeadVehiclePreview leadVehicle={s.vehicle} t={t} />
    </div>
  )
}
