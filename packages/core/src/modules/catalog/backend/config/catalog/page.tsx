import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { PriceKindSettings } from '../../../components/PriceKindSettings'
import { ServiceLineSettings } from '../../../components/ServiceLineSettings'

export default function CatalogConfigurationPage() {
  return (
    <Page>
      <PageBody className="space-y-8">
        <PriceKindSettings />
        <ServiceLineSettings />
      </PageBody>
    </Page>
  )
}
