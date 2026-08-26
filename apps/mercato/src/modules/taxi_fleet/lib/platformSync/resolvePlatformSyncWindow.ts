const DEFAULT_LOOKBACK_HOURS = 26

export function resolveDefaultPlatformSyncWindow(now = new Date()): { windowFrom: Date; windowTo: Date } {
  return {
    windowFrom: new Date(now.getTime() - DEFAULT_LOOKBACK_HOURS * 60 * 60 * 1000),
    windowTo: now,
  }
}

export function resolvePlatformSyncWindow(params: {
  windowFrom?: Date | null
  windowTo?: Date | null
  now?: Date
}): { windowFrom: Date; windowTo: Date } {
  const defaults = resolveDefaultPlatformSyncWindow(params.now ?? new Date())
  return {
    windowFrom: params.windowFrom ?? defaults.windowFrom,
    windowTo: params.windowTo ?? defaults.windowTo,
  }
}
