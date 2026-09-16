'use client'

import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { DriverEntitySyncState } from '../../lib/driverOffline/outboxSyncState'
import { driverBadgeDangerClass, driverBadgeWarningClass } from './driverUi'

type Props = {
  state: DriverEntitySyncState | null | undefined
  className?: string
}

export function DriverSyncStatusBadge({ state, className }: Props) {
  const t = useT()
  if (!state) return null
  if (state === 'failed') {
    return (
      <span className={`${driverBadgeDangerClass} ${className ?? ''}`.trim()}>
        {t('taxi_fleet.driverApp.sync.failedBadge', 'Sync failed')}
      </span>
    )
  }
  return (
    <span className={`${driverBadgeWarningClass} ${className ?? ''}`.trim()}>
      {t('taxi_fleet.driverApp.sync.pendingBadge', 'Waiting to sync')}
    </span>
  )
}
