/**
 * Mirrors receiptExtractionPipeline / maybeEnsureCompanyForExtraction:
 * trip-linked receipts resolve CRM company from buyer NIP;
 * expense uploads (no trip on extraction) use seller (issuer) NIP only —
 * never buyer / fleet NIP fallback.
 * Fleet issuer must never be CRM-ensured as trip buyer (checksum fails → nip_invalid).
 */
import {
  clearFleetBuyerNipOnTripExtraction,
} from '../receiptExtractionCompany'
import { isKnownFleetIssuerNip, RS_MOTO_ISSUER_NIP_DIGITS } from '../receiptOcrSanitize'
import type { TaxiFleetReceiptExtraction } from '../../data/entities'

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

function resolveTripCompanyNip(params: {
  ocrBuyerNip: string | null
}): string | null {
  const nip = params.ocrBuyerNip
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

  it('trip ensure skips fleet issuer mis-stored as buyer (first OCR expense-mode race)', () => {
    expect(resolveTripCompanyNip({ ocrBuyerNip: RS_MOTO_ISSUER_NIP_DIGITS })).toBeNull()
    expect(resolveTripCompanyNip({ ocrBuyerNip: '7010533902' })).toBe('7010533902')
  })

  it('clearFleetBuyerNipOnTripExtraction drops fleet buyer and nip_invalid warning', () => {
    const extraction = {
      tripId: 'trip-1',
      ocrBuyerNip: RS_MOTO_ISSUER_NIP_DIGITS,
      warningsJson: [
        { code: 'nip_invalid', field: 'buyerNip', ocrValue: RS_MOTO_ISSUER_NIP_DIGITS },
        { code: 'low_confidence' },
      ],
      updatedAt: new Date(0),
    } as unknown as TaxiFleetReceiptExtraction

    expect(clearFleetBuyerNipOnTripExtraction(extraction)).toBe(true)
    expect(extraction.ocrBuyerNip).toBeNull()
    expect(extraction.warningsJson).toEqual([{ code: 'low_confidence' }])
  })
})
