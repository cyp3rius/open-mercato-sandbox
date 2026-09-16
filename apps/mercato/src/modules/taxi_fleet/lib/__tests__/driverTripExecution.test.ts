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

  it('completes scheduled trips when a receipt is attached', () => {
    const result = resolveDriverTripUpdateInput(
      'scheduled',
      {
        id: 'trip-1',
        receiptAttachmentId: 'att-1',
      },
      'client',
    )
    expect(result.action).toBe('receipt_complete_scheduled')
    expect(result.input).toMatchObject({
      id: 'trip-1',
      status: 'completed',
    })
    expect(typeof result.input.endedAt).toBe('string')
  })

  it('maps internal scheduled receipt attach to pending_authorization', () => {
    const result = resolveDriverTripUpdateInput(
      'scheduled',
      {
        id: 'trip-1',
        receiptAttachmentId: 'att-1',
      },
      'internal',
    )
    expect(result.action).toBe('receipt_complete_scheduled')
    expect(result.input.status).toBe('pending_authorization')
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
