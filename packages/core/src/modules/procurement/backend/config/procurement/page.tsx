import Link from 'next/link'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Button } from '@open-mercato/ui/primitives/button'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import ProcurementStatusPipelineSettings from '../../../components/ProcurementStatusPipelineSettings'

export default async function ProcurementConfigurationPage({
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
          <Button asChild variant="outline" size="sm">
            <Link href={returnTo}>{translate('common.back', 'Back')}</Link>
          </Button>
        ) : null}
        <ProcurementStatusPipelineSettings />
      </PageBody>
    </Page>
  )
}
