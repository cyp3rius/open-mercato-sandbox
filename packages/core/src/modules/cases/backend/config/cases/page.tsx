import Link from 'next/link'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Button } from '@open-mercato/ui/primitives/button'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'

export default async function CasesSettingsPage({
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
            {translate('cases.config.nav.title', 'Cases settings')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {translate(
              'cases.config.lead',
              'Service cases bring timelines, customers, and linked messages into one workspace.',
            )}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm text-muted-foreground">
            {translate(
              'cases.config.procedureHint',
              'On a case’s detail page you run a single procedure and step through it — including verification conditions.',
            )}
          </p>
          <Button asChild variant="outline" size="sm" type="button" className="mt-3">
            <Link href="/backend/cases">{translate('cases.config.procedureOpenCases', 'Go to cases')}</Link>
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">
                {translate('cases.config.operationsTitle', 'Cases workspace')}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {translate(
                  'cases.config.operationsLead',
                  'Open the cases list to review status, owners, and linked CRM records.',
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="default" type="button">
                <Link href="/backend/cases">{translate('cases.config.openCases', 'Open cases')}</Link>
              </Button>
              <Button asChild variant="outline" type="button">
                <Link href="/backend/cases/create">
                  {translate('cases.config.openCreateCase', 'New case')}
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </PageBody>
    </Page>
  )
}
