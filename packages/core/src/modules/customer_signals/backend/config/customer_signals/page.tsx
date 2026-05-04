import Link from 'next/link'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Button } from '@open-mercato/ui/primitives/button'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'

export default async function CustomerSignalsSettingsPage({
  searchParams,
}: {
  searchParams?: { returnTo?: string | string[] }
}) {
  const { translate } = await resolveTranslations()
  const returnTo =
    typeof searchParams?.returnTo === 'string' && searchParams.returnTo.trim().length
      ? searchParams.returnTo.trim()
      : null

  return (
    <Page>
      <PageBody className="space-y-6">
        {returnTo ? (
          <Button asChild variant="outline" size="sm" type="button">
            <Link href={returnTo}>{translate('common.back', 'Back')}</Link>
          </Button>
        ) : null}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {translate('customer_signals.config.nav.title', 'Customer signals settings')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {translate(
              'customer_signals.config.lead',
              'Behavior signals are recorded per CRM customer and surfaced on the customer workspace.',
            )}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">
                {translate('customer_signals.config.operationsTitle', 'Where signals appear')}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {translate(
                  'customer_signals.config.operationsLead',
                  'Open a company or person in CRM to view the signals panel.',
                )}
              </p>
            </div>
            <Button asChild variant="default" type="button">
              <Link href="/backend/customers/companies">
                {translate('customer_signals.config.openCompanies', 'Customer companies')}
              </Link>
            </Button>
          </div>
        </div>
      </PageBody>
    </Page>
  )
}
