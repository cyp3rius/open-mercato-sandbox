'use client'

import * as React from 'react'
import { Page, PageHeader, PageBody } from '@open-mercato/ui/backend/Page'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { PendingTripsHubSection } from '../../components/hub/PendingTripsHubSection'
import { FleetWeekScheduleHubSection } from '../../components/hub/FleetWeekScheduleHubSection'
import { WeeklySettlementsHubSection } from '../../components/hub/WeeklySettlementsHubSection'
import { MonthlySettlementsHubSection } from '../../components/hub/MonthlySettlementsHubSection'
import { OnlineDriversHubSection } from '../../components/hub/OnlineDriversHubSection'
import { CommunicationsHubSection } from '../../components/hub/CommunicationsHubSection'

export default function TaxiFleetHubPage() {
  const t = useT()

  return (
    <Page>
      <PageHeader
        title={t('taxi_fleet.hub.title', 'Taxi fleet')}
        description={t('taxi_fleet.hub.description', 'Fleet calendar, trips, and weekly settlements.')}
      />
      <PageBody>
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <PendingTripsHubSection />
            <FleetWeekScheduleHubSection />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <WeeklySettlementsHubSection />
            <MonthlySettlementsHubSection />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <OnlineDriversHubSection />
            <CommunicationsHubSection />
          </div>
        </div>
      </PageBody>
    </Page>
  )
}
