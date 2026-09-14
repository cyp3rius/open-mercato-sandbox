'use client'

import * as React from 'react'
import { Page, PageHeader, PageBody } from '@open-mercato/ui/backend/Page'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { WeeklySettlementsHubSection } from '../../../components/hub/WeeklySettlementsHubSection'
import { MonthlySettlementsHubSection } from '../../../components/hub/MonthlySettlementsHubSection'
import { VehicleSettlementsHubSection } from '../../../components/hub/VehicleSettlementsHubSection'

export default function TaxiFleetSettlementsOverviewPage() {
  const t = useT()

  return (
    <Page>
      <PageHeader
        title={t('taxi_fleet.settlements.title', 'Settlements')}
        description={t(
          'taxi_fleet.settlements.overview.hint',
          'Driver settlements now; vehicle settlements will follow.',
        )}
      />
      <PageBody>
        <div className="space-y-8">
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {t('taxi_fleet.settlements.overview.driversSection', 'Drivers')}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(
                  'taxi_fleet.settlements.overview.driversHint',
                  'Weekly control settlements and monthly payout settlements per driver.',
                )}
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <WeeklySettlementsHubSection />
              <MonthlySettlementsHubSection />
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {t('taxi_fleet.settlements.overview.vehiclesSection', 'Vehicles')}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(
                  'taxi_fleet.settlements.overview.vehiclesHint',
                  'Separate vehicle settlement submodule (details coming next).',
                )}
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <VehicleSettlementsHubSection />
            </div>
          </section>
        </div>
      </PageBody>
    </Page>
  )
}
