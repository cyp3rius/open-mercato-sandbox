import { driverExpenseCreateSchema } from '../../data/validators'
import { mapDriverExpenseToCreateInput } from '../driverExpenses'

describe('driver expense create payload', () => {
  it('maps a fuel cost onto financial_entries.create input', () => {
    const parsed = driverExpenseCreateSchema.parse({
      costType: 'fuel',
      amount: 468.82,
      documentNumber: 'FV/1',
      occurredAt: '2026-07-14T10:00:00.000Z',
    })
    const input = mapDriverExpenseToCreateInput(parsed, {
      tenantId: '11111111-1111-1111-1111-111111111111',
      organizationId: '22222222-2222-2222-2222-222222222222',
      teamMemberId: '33333333-3333-3333-3333-333333333333',
    })
    expect(input.kind).toBe('expense')
    expect(input.costType).toBe('fuel')
    expect(input.amount).toBe(468.82)
    expect(input.vatRatePercent).toBe(23)
    expect(input.currencyCode).toBe('PLN')
    expect(input.documentNumber).toBe('FV/1')
  })

  it('accepts 8% VAT on driver expense', () => {
    const parsed = driverExpenseCreateSchema.parse({
      costType: 'parking',
      amount: 10.8,
      vatRatePercent: 8,
    })
    expect(parsed.vatRatePercent).toBe(8)
  })

  it('rejects zero amount', () => {
    expect(() => driverExpenseCreateSchema.parse({ costType: 'parking', amount: 0 })).toThrow()
  })
})
