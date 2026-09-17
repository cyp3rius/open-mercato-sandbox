import { normalizeNipDigits } from '@open-mercato/core/modules/customers/lib/nip'
import type { ReceiptOcrWarning } from './receiptExtractionRules'

export type TripCustomerOcrLinkDecision =
  | { action: 'noop' }
  | { action: 'apply'; companyEntityId: string; clearPerson: boolean }
  | {
      action: 'conflict'
      ocrBuyerNip: string
      driverValue: string | null
    }

/**
 * Decide whether OCR buyer NIP should auto-link a company, conflict with the
 * trip customer (person or different company), or do nothing.
 */
export function decideTripCustomerOcrLink(params: {
  ocrBuyerNip: string | null | undefined
  resolvedCompanyId: string | null | undefined
  tripCustomerPersonId: string | null | undefined
  tripCustomerCompanyId: string | null | undefined
  linkedCompanyNip: string | null | undefined
  preferOcrOnConflict: boolean
}): TripCustomerOcrLinkDecision {
  const ocrBuyerNip = normalizeNipDigits(params.ocrBuyerNip ?? '') || null
  if (!ocrBuyerNip) return { action: 'noop' }

  const resolvedCompanyId =
    typeof params.resolvedCompanyId === 'string' && params.resolvedCompanyId.trim()
      ? params.resolvedCompanyId.trim()
      : null
  const tripCustomerPersonId =
    typeof params.tripCustomerPersonId === 'string' && params.tripCustomerPersonId.trim()
      ? params.tripCustomerPersonId.trim()
      : null
  const tripCustomerCompanyId =
    typeof params.tripCustomerCompanyId === 'string' && params.tripCustomerCompanyId.trim()
      ? params.tripCustomerCompanyId.trim()
      : null
  const linkedCompanyNip = normalizeNipDigits(params.linkedCompanyNip ?? '') || null

  const nipMatchesLinkedCompany = Boolean(linkedCompanyNip && linkedCompanyNip === ocrBuyerNip)
  const resolvedMatchesLinked = Boolean(
    resolvedCompanyId && tripCustomerCompanyId && resolvedCompanyId === tripCustomerCompanyId,
  )

  if (nipMatchesLinkedCompany || resolvedMatchesLinked) {
    if (resolvedCompanyId && tripCustomerCompanyId !== resolvedCompanyId) {
      return { action: 'apply', companyEntityId: resolvedCompanyId, clearPerson: false }
    }
    return { action: 'noop' }
  }

  // Person linked (no matching company NIP) → always operator confirmation.
  if (tripCustomerPersonId && !params.preferOcrOnConflict) {
    return {
      action: 'conflict',
      ocrBuyerNip,
      driverValue: linkedCompanyNip,
    }
  }

  // Different company already linked.
  if (tripCustomerCompanyId && !params.preferOcrOnConflict) {
    return {
      action: 'conflict',
      ocrBuyerNip,
      driverValue: linkedCompanyNip,
    }
  }

  if (resolvedCompanyId) {
    return {
      action: 'apply',
      companyEntityId: resolvedCompanyId,
      clearPerson: Boolean(tripCustomerPersonId) || params.preferOcrOnConflict,
    }
  }

  // OCR NIP present, no resolvable company yet, but a customer is linked → conflict
  // so the operator can retry via Nadpisz → Klient.
  if (tripCustomerPersonId || tripCustomerCompanyId) {
    return {
      action: 'conflict',
      ocrBuyerNip,
      driverValue: linkedCompanyNip,
    }
  }

  return { action: 'noop' }
}

export function upsertCustomerNipConflictWarning(
  warnings: ReceiptOcrWarning[],
  params: { ocrBuyerNip: string; driverValue?: string | null },
): ReceiptOcrWarning[] {
  const withoutStale = warnings.filter(
    (warning) =>
      !(
        warning.field === 'buyerNip' &&
        (warning.code === 'customer_nip_conflict' ||
          warning.code === 'nip_not_found' ||
          warning.code === 'nip_lookup_failed')
      ),
  )
  withoutStale.push({
    code: 'customer_nip_conflict',
    field: 'buyerNip',
    ocrValue: params.ocrBuyerNip,
    driverValue: params.driverValue ?? null,
  })
  return withoutStale
}

export function clearCustomerNipConflictWarnings(warnings: ReceiptOcrWarning[]): ReceiptOcrWarning[] {
  return warnings.filter(
    (warning) =>
      !(
        warning.field === 'buyerNip' &&
        (warning.code === 'customer_nip_conflict' ||
          warning.code === 'nip_not_found' ||
          warning.code === 'nip_lookup_failed' ||
          warning.code === 'nip_invalid')
      ),
  )
}
