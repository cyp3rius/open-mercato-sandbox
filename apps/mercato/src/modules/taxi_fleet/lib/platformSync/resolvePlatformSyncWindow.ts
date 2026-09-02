export const MANUAL_PLATFORM_SYNC_LOOKBACK_DAYS = 7

/** First scheduled run (no prior successful live sync) — one hour aligns with hourly cron. */
export const SCHEDULE_PLATFORM_SYNC_FALLBACK_HOURS = 1

export function resolveManualPlatformSyncWindow(now = new Date()): {
  windowFrom: Date
  windowTo: Date
} {
  return {
    windowFrom: new Date(now.getTime() - MANUAL_PLATFORM_SYNC_LOOKBACK_DAYS * 24 * 60 * 60 * 1000),
    windowTo: now,
  }
}

export function resolveScheduledPlatformSyncWindow(
  lastSuccessfulFetchEnd: Date | null,
  now = new Date(),
): { windowFrom: Date; windowTo: Date } {
  const windowTo = now
  const windowFrom =
    lastSuccessfulFetchEnd ??
    new Date(now.getTime() - SCHEDULE_PLATFORM_SYNC_FALLBACK_HOURS * 60 * 60 * 1000)
  return { windowFrom, windowTo }
}

/** Explicit API override (optional windowFrom/windowTo on sync run). */
export function resolvePlatformSyncWindow(params: {
  windowFrom?: Date | null
  windowTo?: Date | null
  now?: Date
}): { windowFrom: Date; windowTo: Date } {
  const now = params.now ?? new Date()
  const windowTo = params.windowTo ?? now
  if (params.windowFrom != null) {
    return { windowFrom: params.windowFrom, windowTo }
  }
  return resolveManualPlatformSyncWindow(now)
}

/** @deprecated Use resolveManualPlatformSyncWindow — kept for tests migrating from 26h default. */
export function resolveDefaultPlatformSyncWindow(now = new Date()): {
  windowFrom: Date
  windowTo: Date
} {
  return resolveManualPlatformSyncWindow(now)
}
