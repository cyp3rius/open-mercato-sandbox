"use client"

import type { TranslateFn } from '@open-mercato/shared/lib/i18n/context'
import { PreviewFieldCell, PreviewFieldGrid } from '../leads/leadDetailPreviewUtils'

export type PolicyBasicsPreviewLabels = {
  insurer: string
  insurerContact: string
  caretaker: string
  partner: string
  product: string
  status: string
}

function dash(s: string) {
  return s.trim().length ? s : '—'
}

export function PolicyBasicsPreview({
  form,
  labels,
  t,
}: {
  form: Record<string, unknown>
  labels: PolicyBasicsPreviewLabels
  t: TranslateFn
}) {
  const policyNumber = typeof form.policyNumber === 'string' ? form.policyNumber : ''
  const validFrom = typeof form.validFrom === 'string' ? form.validFrom : ''
  const validTo = typeof form.validTo === 'string' ? form.validTo : ''

  const fmtDate = (raw: string) => {
    if (!raw.trim().length) return '—'
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString()
  }

  return (
    <PreviewFieldGrid>
      <PreviewFieldCell
        label={t('insurance_desk.policies.form.policyNumber', 'Policy number')}
        value={dash(policyNumber)}
      />
      <PreviewFieldCell label={t('insurance_desk.policies.form.insurer', 'Insurer')} value={dash(labels.insurer)} />
      <PreviewFieldCell
        label={t('insurance_desk.policies.form.insurerContact', 'Insurer contact')}
        value={dash(labels.insurerContact)}
      />
      <PreviewFieldCell
        label={t('insurance_desk.policies.form.caretaker', 'Caretaker')}
        value={dash(labels.caretaker)}
      />
      <PreviewFieldCell
        label={t('insurance_desk.policies.form.referringPartyEntity', 'Referring party')}
        value={dash(labels.partner)}
      />
      <PreviewFieldCell
        label={t('insurance_desk.policies.form.catalogProduct', 'Catalog product')}
        value={dash(labels.product)}
      />
      <PreviewFieldCell label={t('insurance_desk.policies.form.validFrom', 'Valid from')} value={fmtDate(validFrom)} />
      <PreviewFieldCell label={t('insurance_desk.policies.form.validTo', 'Valid to')} value={fmtDate(validTo)} />
      <PreviewFieldCell label={t('insurance_desk.policies.form.status', 'Status')} value={dash(labels.status)} />
    </PreviewFieldGrid>
  )
}
