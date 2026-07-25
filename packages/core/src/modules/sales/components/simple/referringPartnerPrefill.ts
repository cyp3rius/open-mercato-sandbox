/**
 * Pure helpers for copying referring partner across deal → quote → order prefills.
 * Kept free of React/UI imports so unit tests stay lightweight.
 */

export function resolveReferringPartnerFromDealApi(payload: {
  deal?: { referringPartnerEntityId?: string | null } | null
  referringPartner?: { id?: string; label?: string } | null
}): { referringPartnerEntityId: string; referringPartnerLabel: string } {
  const fromDeal =
    typeof payload.deal?.referringPartnerEntityId === 'string'
      ? payload.deal.referringPartnerEntityId.trim()
      : ''
  const fromAssociation =
    typeof payload.referringPartner?.id === 'string' ? payload.referringPartner.id.trim() : ''
  const referringPartnerEntityId = fromDeal || fromAssociation
  const referringPartnerLabel =
    typeof payload.referringPartner?.label === 'string' ? payload.referringPartner.label : ''
  return { referringPartnerEntityId, referringPartnerLabel }
}

export function resolveReferringPartnerFromQuoteDoc(doc: Record<string, unknown>): string {
  return typeof doc.referringPartnerEntityId === 'string' ? doc.referringPartnerEntityId.trim() : ''
}
