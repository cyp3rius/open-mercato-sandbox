import {
  notifyTaxiFleetBroadcast,
} from '../lib/taxiFleetNotificationDelivery'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'

export const metadata = {
  event: 'taxi_fleet.platform_sync.completed',
  persistent: true,
  id: 'taxi_fleet:platform-sync-completed-notification',
}

type PlatformSyncCompletedPayload = {
  id: string
  tenantId: string
  organizationId: string
  platform?: string
  trigger?: string
  status?: string
  createdCount?: number
  duplicateCount?: number
  skippedCount?: number
  unmappedDriverSkippedCount?: number
  errorCount?: number
}

type ResolverContext = {
  resolve: <T = unknown>(name: string) => T
}

export default async function handle(payload: PlatformSyncCompletedPayload, ctx: ResolverContext) {
  if (!payload.id || !payload.tenantId || !payload.organizationId) return
  if (payload.trigger !== 'csv') return

  const { translate } = await resolveTranslations()
  const unmapped = payload.unmappedDriverSkippedCount ?? 0
  const unmappedLine =
    unmapped > 0
      ? ` ${translate(
          'taxi_fleet.platformSync.summary.unmappedDriversSkipped',
          '{count} trips skipped — no driver mapping in CRM.',
          { count: String(unmapped) },
        )}`
      : ''

  await notifyTaxiFleetBroadcast(ctx, {
    notificationType: 'taxi_fleet.platform_sync.completed',
    tenantId: payload.tenantId,
    organizationId: payload.organizationId,
    titleVariables: {
      platform: payload.platform ?? 'all',
      status: payload.status ?? '',
    },
    bodyVariables: {
      platform: payload.platform ?? 'all',
      status: payload.status ?? '',
      created: String(payload.createdCount ?? 0),
      duplicates: String(payload.duplicateCount ?? 0),
      skipped: String(payload.skippedCount ?? 0),
      errors: String(payload.errorCount ?? 0),
      unmappedLine,
    },
    sourceEntityType: 'taxi_fleet:platform_sync_run',
    sourceEntityId: payload.id,
    linkHref: '/backend/taxi-fleet/trips',
    logLabel: 'taxi_fleet:platform-sync-completed-notification',
  })
}
