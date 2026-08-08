"use client"

import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { TaxiFleetModuleSettings } from '../../../components/config/TaxiFleetModuleSettings'

export default function TaxiFleetConfigPage() {
  const t = useT()

  return (
    <Page>
      <PageBody>
        <div className="space-y-6">
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold">
              {t('taxi_fleet.config.title', 'Taxi fleet settings')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t(
                'taxi_fleet.config.description',
                'Fleet defaults, PayPal and Google Calendar integrations, and customer email templates.',
              )}
            </p>
          </header>
          <TaxiFleetModuleSettings />
        </div>
      </PageBody>
    </Page>
  )
}
