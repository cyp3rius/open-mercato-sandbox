import { resolveDriverTripUpdateInput } from '../driverTripExecution'

describe('resolveDriverTripUpdateInput', () => {
  it('allows receipt supplement on completed trips without other fields', () => {
    const result = resolveDriverTripUpdateInput('completed', {
      id: 'trip-1',
      receiptAttachmentId: 'att-1',
      receiptDocumentNumber: 'FV/1',
    })
    expect(result.action).toBe('receipt_supplement')
    expect(result.input).toEqual({ id: 'trip-1' })
  })

  it('rejects completed trip updates outside receipt supplement', () => {
    expect(() =>
      resolveDriverTripUpdateInput('completed', {
        id: 'trip-1',
        revenueAmount: 100,
      }),
    ).toThrow()
  })
})
