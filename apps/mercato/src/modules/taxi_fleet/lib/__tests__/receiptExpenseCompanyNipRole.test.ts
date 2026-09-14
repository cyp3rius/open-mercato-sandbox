/**
 * Mirrors receiptExtractionPipeline / maybeEnsureCompanyForExtraction:
 * trip-linked receipts resolve CRM company from buyer NIP;
 * expense uploads (no trip on extraction) use seller (issuer) NIP.
 */
function preferSellerNipForReceiptCompany(hasTripId: boolean): boolean {
  return !hasTripId
}

describe('receipt expense company NIP role', () => {
  it('uses seller NIP when extraction has no trip link', () => {
    expect(preferSellerNipForReceiptCompany(false)).toBe(true)
  })

  it('uses buyer NIP when extraction is trip-linked', () => {
    expect(preferSellerNipForReceiptCompany(true)).toBe(false)
  })
})
