'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Button } from '@open-mercato/ui/primitives/button'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Building2 } from 'lucide-react'
import { CompanyRegistrySyncToolbarButton } from '@open-mercato/core/modules/customers/components/companyRegistrySync'

export default function AccountingSettingsHubPage() {
  const t = useT()
  const router = useRouter()
  return (
    <Page>
      <PageBody className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t('accounting.settings.hub.title', 'Accounting settings')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              'accounting.settings.hub.lead',
              'Configure selling companies, bank accounts, and invoice number formats used when issuing invoices.',
            )}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="h-4 w-4" />
                {t('accounting.settings.hub.sellingEntitiesTitle', 'Selling companies')}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(
                  'accounting.settings.hub.sellingEntitiesLead',
                  'Add companies that issue invoices, with bank details and invoice numbering.',
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CompanyRegistrySyncToolbarButton
                onSuccess={async (data) => {
                  const q = new URLSearchParams()
                  const name = (data.legalName || data.displayName || '').trim()
                  if (name) q.set('prefillName', name)
                  if (data.nip) q.set('prefillNip', data.nip)
                  if (data.regon) q.set('prefillRegon', data.regon)
                  const addrLine = [data.addressLine1, [data.postalCode, data.city].filter(Boolean).join(' ')]
                    .filter(Boolean)
                    .join(', ')
                    .trim()
                  if (addrLine) q.set('prefillAddress', addrLine)
                  router.push(`/backend/config/accounting/entities/create?${q.toString()}`)
                }}
              />
              <Button asChild variant="outline">
                <Link href="/backend/config/accounting/entities">
                  {t('accounting.settings.hub.openEntities', 'Manage companies')}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </PageBody>
    </Page>
  )
}
