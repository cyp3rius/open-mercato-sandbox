import { createTripIncomeIfNeeded } from '../createTripIncomeIfNeeded'

describe('createTripIncomeIfNeeded', () => {
  it('returns null when revenue or customer is missing', async () => {
    const commandBus = { execute: jest.fn() }
    const ctx = { container: { resolve: jest.fn() } }
    const result = await createTripIncomeIfNeeded({
      commandBus: commandBus as never,
      ctx: ctx as never,
      scoped: {
        tenantId: 't1',
        organizationId: 'o1',
        teamMemberId: 'd1',
        tripId: 'trip-1',
        revenueAmount: 0,
        customerCompanyId: 'c1',
      },
      receiptAttachmentId: 'att-1',
    })
    expect(result).toBeNull()
    expect(commandBus.execute).not.toHaveBeenCalled()
  })

  it('returns existing income id without creating again', async () => {
    const findOne = jest.fn().mockResolvedValue({ id: 'entry-existing' })
    const commandBus = { execute: jest.fn() }
    const ctx = {
      container: {
        resolve: jest.fn().mockReturnValue({ findOne }),
      },
    }
    const result = await createTripIncomeIfNeeded({
      commandBus: commandBus as never,
      ctx: ctx as never,
      scoped: {
        tenantId: 't1',
        organizationId: 'o1',
        teamMemberId: 'd1',
        tripId: 'trip-1',
        revenueAmount: 120,
        customerCompanyId: 'c1',
      },
      receiptAttachmentId: 'att-1',
    })
    expect(result).toBe('entry-existing')
    expect(commandBus.execute).not.toHaveBeenCalled()
  })

  it('creates income via command when prerequisites are met', async () => {
    const findOne = jest.fn().mockResolvedValue(null)
    const commandBus = {
      execute: jest.fn().mockResolvedValue({ result: { entryId: 'entry-new' } }),
    }
    const ctx = {
      container: {
        resolve: jest.fn().mockReturnValue({ findOne }),
      },
    }
    const result = await createTripIncomeIfNeeded({
      commandBus: commandBus as never,
      ctx: ctx as never,
      scoped: {
        tenantId: 't1',
        organizationId: 'o1',
        teamMemberId: 'd1',
        tripId: 'trip-1',
        revenueAmount: '85.50',
        currencyCode: 'PLN',
        customerPersonId: 'p1',
        startedAt: '2026-03-20T10:00:00.000Z',
      },
      receiptAttachmentId: 'att-1',
      receiptDocumentNumber: 'ABC/1',
    })
    expect(result).toBe('entry-new')
    expect(commandBus.execute).toHaveBeenCalledWith(
      'taxi_fleet.financial_entries.create',
      expect.objectContaining({
        input: expect.objectContaining({
          tripId: 'trip-1',
          amount: 85.5,
          receiptAttachmentId: 'att-1',
          documentNumber: 'ABC/1',
        }),
      }),
    )
  })
})
