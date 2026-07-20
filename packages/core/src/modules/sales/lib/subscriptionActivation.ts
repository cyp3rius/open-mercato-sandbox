/**
 * Which sales order status values trigger CatalogCustomerOffering upsert/activation
 * for subscription (and existing non-subscription) lines.
 * Empty / null settings ⇒ default `['confirmed']` (backward compatible).
 */
export const DEFAULT_SUBSCRIPTION_ACTIVATION_ORDER_STATUSES = ['confirmed'] as const

export function resolveSubscriptionActivationOrderStatuses(
  raw: string[] | null | undefined,
): string[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [...DEFAULT_SUBSCRIPTION_ACTIVATION_ORDER_STATUSES]
  }
  const out: string[] = []
  const seen = new Set<string>()
  for (const entry of raw) {
    if (typeof entry !== 'string') continue
    const value = entry.trim().toLowerCase()
    if (!value.length || seen.has(value)) continue
    seen.add(value)
    out.push(value)
  }
  return out.length ? out : [...DEFAULT_SUBSCRIPTION_ACTIVATION_ORDER_STATUSES]
}

export function isSubscriptionActivationOrderStatus(
  status: string | null | undefined,
  configuredStatuses: string[] | null | undefined,
): boolean {
  const value = typeof status === 'string' ? status.trim().toLowerCase() : ''
  if (!value.length) return false
  const allowed = resolveSubscriptionActivationOrderStatuses(configuredStatuses)
  return allowed.includes(value)
}
