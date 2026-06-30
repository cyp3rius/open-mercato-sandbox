"use client"

import { useT } from '@open-mercato/shared/lib/i18n/context'
import {
  DealReferringPartnerPreview,
  type DealReferringPartnerAssociation,
} from '@open-mercato/core/modules/customers/components/detail/DealReferringPartnerPreview'

export function ReferringPartnerSidebarCard({
  partner,
}: {
  partner: DealReferringPartnerAssociation | null | undefined
}) {
  const t = useT()
  if (!partner) return null

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-3 space-y-1">
        <h2 className="text-sm font-semibold">
          {t('customers.deals.detail.referringPartnerSection', 'Referring party')}
        </h2>
      </div>
      <DealReferringPartnerPreview partner={partner} />
    </div>
  )
}
