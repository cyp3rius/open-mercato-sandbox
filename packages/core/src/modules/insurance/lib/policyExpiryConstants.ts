export const POLICY_EXPIRY_NOTICE_DAYS = [60, 30, 14, 7] as const

export type PolicyExpiryNoticeDay = (typeof POLICY_EXPIRY_NOTICE_DAYS)[number]

export const INSURANCE_POLICY_EXPIRY_CHECK_QUEUE = 'insurance-policy-expiry-check'

export function buildPolicyExpiryScheduleId(tenantId: string, organizationId: string): string {
  return `insurance:policy-expiry-check:${tenantId}:${organizationId}`
}

export function utcDateKey(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

export function daysUntilUtcDate(validTo: Date, reference = new Date()): number {
  const validToKey = utcDateKey(validTo)
  const referenceKey = utcDateKey(reference)
  if (validToKey === referenceKey) return 0
  const validToMs = Date.parse(`${validToKey}T00:00:00.000Z`)
  const referenceMs = Date.parse(`${referenceKey}T00:00:00.000Z`)
  return Math.round((validToMs - referenceMs) / (24 * 60 * 60 * 1000))
}
