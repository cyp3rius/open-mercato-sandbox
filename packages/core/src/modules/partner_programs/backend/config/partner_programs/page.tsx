import Link from 'next/link'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Button } from '@open-mercato/ui/primitives/button'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'

export default async function PartnerProgramsSettingsPage({
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
            {translate('partner_programs.config.nav.title', 'Partner programs settings')}
          </h1>
          <p className="text-sm text-muted-foreground">
            {translate(
              'partner_programs.config.lead',
              'Central hub for loyalty and B2B partner programs.',
            )}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">
                {translate('partner_programs.config.operationsTitle', 'Programs workspace')}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {translate(
                  'partner_programs.config.operationsLead',
                  'Create programs, define validity windows, and attach CRM partner companies.',
                )}
              </p>
            </div>
            <Button asChild variant="default" type="button">
              <Link href="/backend/partner_programs/programs">
                {translate('partner_programs.config.openPrograms', 'Open programs')}
              </Link>
            </Button>
          </div>
        </div>
      </PageBody>
    </Page>
  )
}
