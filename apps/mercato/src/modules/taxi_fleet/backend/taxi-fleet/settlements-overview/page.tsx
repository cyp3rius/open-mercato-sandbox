"use client"

import * as React from 'react'
import Link from 'next/link'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { TAXI_FLEET_BASE } from '../paths'

export default function TaxiFleetSettlementsOverviewPage() {
  const t = useT()

  return (
    <Page>
      <PageBody className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">{t('taxi_fleet.settlements.title', 'Rozliczenia')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('taxi_fleet.settlements.overview.hint', 'Choose weekly or monthly settlements.')}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={`${TAXI_FLEET_BASE}/settlements-overview/weekly`}
            className="rounded-lg border bg-card p-4 hover:bg-muted/30"
          >
            <div className="text-sm font-medium">{t('taxi_fleet.settlements.weeklyTitle', 'Weekly settlements')}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {t(
                'taxi_fleet.hub.settlementsHelp',
                'Weekly control settlements (no payout).',
              )}
            </div>
          </Link>

          <Link
            href={`${TAXI_FLEET_BASE}/settlements-overview/monthly`}
            className="rounded-lg border bg-card p-4 hover:bg-muted/30"
          >
            <div className="text-sm font-medium">{t('taxi_fleet.monthlySettlements.title', 'Monthly settlements')}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {t(
                'taxi_fleet.hub.monthlySettlementsHelp',
                'Per-driver monthly settlements used for payout.',
              )}
            </div>
          </Link>
        </div>
      </PageBody>
    </Page>
  )
}

