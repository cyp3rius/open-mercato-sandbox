/**
 * Mirrors receiptExtractionPipeline / maybeEnsureCompanyForExtraction:
 * trip-linked receipts resolve CRM company from buyer NIP;
 * expense uploads (no trip on extraction) use seller (issuer) NIP only —
 * never buyer / fleet NIP fallback.
 */
import { isKnownFleetIssuerNip } from '../receiptOcrSanitize'

function preferSellerNipForReceiptCompany(hasTripId: boolean): boolean {
  return !hasTripId
}

function resolveExpenseCompanyNip(params: {
  ocrSellerNip: string | null
  ocrBuyerNip: string | null
}): string | null {
  const nip = params.ocrSellerNip
  if (!nip) return null
  if (isKnownFleetIssuerNip(nip)) return null
  return nip
}

describe('receipt expense company NIP role', () => {
  it('uses seller NIP when extraction has no trip link', () => {
    expect(preferSellerNipForReceiptCompany(false)).toBe(true)
  })

  it('uses buyer NIP when extraction is trip-linked', () => {
    expect(preferSellerNipForReceiptCompany(true)).toBe(false)
  })

  it('expense ensure uses seller only and skips fleet NIP', () => {
    expect(
      resolveExpenseCompanyNip({
        ocrSellerNip: '7740001454',
        ocrBuyerNip: '9452189152',
      }),
    ).toBe('7740001454')
    expect(
      resolveExpenseCompanyNip({
        ocrSellerNip: null,
        ocrBuyerNip: '9452189152',
      }),
    ).toBeNull()
    expect(
      resolveExpenseCompanyNip({
        ocrSellerNip: '9452189182',
        ocrBuyerNip: null,
      }),
    ).toBeNull()
  })
})
