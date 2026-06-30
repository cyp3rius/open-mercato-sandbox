"use client"

import * as React from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'

import type { ReferringPartnerAssociation } from '../../lib/referringPartnerAssociation'

export type DealReferringPartnerAssociation = ReferringPartnerAssociation

function recordTypeLabel(
  t: (key: string, fallback?: string) => string,
  crmRecordType: string | null | undefined,
): string | null {
  if (crmRecordType === 'partner') {
    return t('customers.people.form.crmRecordType.partner', 'Partner')
  }
  if (crmRecordType === 'referrer') {
    return t('customers.people.form.crmRecordType.referrer', 'Referrer')
  }
  return null
}

export function DealReferringPartnerPreview({
  partner,
}: {
  partner: DealReferringPartnerAssociation
}) {
  const t = useT()

  const href =
    partner.kind === 'company'
      ? `/backend/customers/companies-v2/${encodeURIComponent(partner.id)}`
      : `/backend/customers/people-v2/${encodeURIComponent(partner.id)}`
  const typeLabel = recordTypeLabel(t, partner.crmRecordType)
  const kindLabel =
    partner.kind === 'company'
      ? t('customers.deals.detail.referringPartnerKindCompany', 'Company')
      : t('customers.deals.detail.referringPartnerKindPerson', 'Person')

  return (
    <div className="relative rounded-md border border-border/60 bg-background/80 px-3 py-3 text-sm">
      <Button
        type="button"
        variant="outline"
        size="sm"
        asChild
        className="absolute end-3 top-3 z-10 shrink-0"
      >
        <Link
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2"
        >
          <ExternalLink className="size-4 shrink-0" aria-hidden />
          {t('common.open', 'Open')}
        </Link>
      </Button>
      <div className="pe-28">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t('customers.deals.detail.referringPartnerSection', 'Referring party')}
        </div>
        <div className="mt-2 space-y-1">
          <p className="font-medium text-foreground">{partner.label}</p>
          <p className="text-xs text-muted-foreground">
            {[kindLabel, typeLabel].filter(Boolean).join(' · ')}
            {partner.subtitle ? ` · ${partner.subtitle}` : ''}
          </p>
          {partner.referralCode ? (
            <p className="text-xs text-muted-foreground">
              {t('customers.people.form.referralCode', 'Referral code')}:{' '}
              <span className="font-mono text-foreground">{partner.referralCode}</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
