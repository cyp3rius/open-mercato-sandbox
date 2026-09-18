/** Verbose taxi_fleet diagnostics for local/staging — never in production. */
export function isTaxiFleetNonProductionDebug(): boolean {
  return process.env.NODE_ENV !== 'production'
}

export function taxiFleetDebugLog(
  scope: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (!isTaxiFleetNonProductionDebug()) return
  if (data !== undefined) {
    console.info(`[taxi_fleet.${scope}] ${message}`, data)
    return
  }
  console.info(`[taxi_fleet.${scope}] ${message}`)
}
