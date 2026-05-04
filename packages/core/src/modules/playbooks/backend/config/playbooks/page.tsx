import Link from 'next/link'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Button } from '@open-mercato/ui/primitives/button'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'

export default async function PlaybooksSettingsPage({
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
            {translate('playbooks.config.nav.title', 'Playbooks settings')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {translate(
              'playbooks.config.lead',
              'Playbooks store reusable guidance matched by context tags on cases and other CRM flows.',
            )}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">
                {translate('playbooks.config.operationsTitle', 'Playbooks workspace')}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {translate(
                  'playbooks.config.operationsLead',
                  'Manage titles, audience, versioning, and activation from the playbooks list.',
                )}
              </p>
            </div>
            <Button asChild variant="default" type="button">
              <Link href="/backend/playbooks">
                {translate('playbooks.config.openPlaybooks', 'Open playbooks')}
              </Link>
            </Button>
          </div>
        </div>
      </PageBody>
    </Page>
  )
}
