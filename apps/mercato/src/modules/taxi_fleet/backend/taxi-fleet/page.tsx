"use client"

import * as React from 'react'
import { Page, PageHeader, PageBody } from '@open-mercato/ui/backend/Page'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { TAXI_FLEET_BASE } from './paths'
import { PendingTripsHubSection } from '../../components/hub/PendingTripsHubSection'
import { FleetWeekScheduleHubSection } from '../../components/hub/FleetWeekScheduleHubSection'
import { FleetHubLinkSection } from '../../components/hub/FleetHubLinkSection'

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
            <FleetHubLinkSection
              titleKey="taxi_fleet.settlements.weeklyTitle"
              titleFallback="Weekly settlements"
              descriptionKey="taxi_fleet.hub.settlementsHelp"
              descriptionFallback="Weekly driver settlements and payouts."
              href={`${TAXI_FLEET_BASE}/settlements-overview/weekly`}
              actionKey="taxi_fleet.hub.settlements.open"
              actionFallback="Open weekly settlements"
            />
            <FleetHubLinkSection
              titleKey="taxi_fleet.monthlySettlements.title"
              titleFallback="Monthly settlements"
              descriptionKey="taxi_fleet.hub.monthlySettlementsHelp"
              descriptionFallback="Fleet monthly rollup from weekly settlements."
              href={`${TAXI_FLEET_BASE}/settlements-overview/monthly`}
              actionKey="taxi_fleet.hub.monthlySettlements.open"
              actionFallback="Open monthly settlements"
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <FleetHubLinkSection
              titleKey="taxi_fleet.drivers.title"
              titleFallback="Driver profiles"
              descriptionKey="taxi_fleet.hub.driversHelp"
              descriptionFallback="Payout percent and mobile app access."
              href={`${TAXI_FLEET_BASE}/drivers`}
              actionKey="taxi_fleet.hub.drivers.open"
              actionFallback="Open driver profiles"
            />
          </div>
        </div>
      </PageBody>
    </Page>
  )
}
