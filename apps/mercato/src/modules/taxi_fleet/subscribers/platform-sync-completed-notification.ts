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

/**
 * Intentionally silent.
 * Bolt / Uber / Free CSV imports surface created/duplicate/skipped counts in the import UI.
 * Do not spam the inbox with per-run (or previously per-CSV) notifications.
 */
export default async function handle(
  _payload: PlatformSyncCompletedPayload,
  _ctx: ResolverContext,
) {
  return
}
