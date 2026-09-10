'use client'

import { useT } from '@open-mercato/shared/lib/i18n/context'
import { SettlementCashSummaryPanel } from './SettlementCashSummaryPanel'

type SettlementCashPanelProps = {
  settlementId: string
  cashExpected: string
  cashCollected: string
  readOnly: boolean
  crudResource?: string
  onUpdated: () => Promise<void>
}

export function SettlementCashPanel({
  settlementId,
  cashExpected,
  cashCollected,
  readOnly,
  crudResource = 'taxi_fleet/settlements',
  onUpdated,
}: SettlementCashPanelProps) {
  const t = useT()

  return (
    <section className="space-y-4 rounded-lg border bg-card px-4 py-3">
      <h3 className="text-sm font-semibold">
        {t('taxi_fleet.settlements.cashSummary.title', 'Cash summary')}
      </h3>
      <SettlementCashSummaryPanel
        settlementId={settlementId}
        cashExpected={cashExpected}
        cashCollected={cashCollected}
        readOnly={readOnly}
        crudResource={crudResource}
        onUpdated={onUpdated}
        embedded
      />
    </section>
  )
}
