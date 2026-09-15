import {
  isCompletedTripReceiptSupplementUpdate,
  isTripDetailFieldEditable,
  isTripDriverChangeAllowed,
  tripDetailAllowsDriverEdit,
  tripDetailLockMode,
} from '../tripDetailWorkflow'

describe('tripDetailLockMode', () => {
  it('locks completed trips by default', () => {
    expect(tripDetailLockMode('completed')).toBe('full')
    expect(isTripDetailFieldEditable('completed', 'revenueAmount')).toBe(false)
  })

  it('unlocks completed trips when allowEditCompleted is set', () => {
    expect(tripDetailLockMode('completed', { allowEditCompleted: true })).toBe('none')
    expect(
      isTripDetailFieldEditable('completed', 'revenueAmount', { allowEditCompleted: true }),
    ).toBe(true)
  })

  it('keeps cancelled trips locked even with allowEditCompleted', () => {
    expect(tripDetailLockMode('cancelled', { allowEditCompleted: true })).toBe('full')
  })

  it('allows editing trips waiting for internal authorization', () => {
    expect(tripDetailLockMode('pending_authorization')).toBe('none')
    expect(isTripDetailFieldEditable('pending_authorization', 'revenueAmount')).toBe(true)
  })

  it('allows only status edits on scheduled trips', () => {
    expect(tripDetailLockMode('scheduled')).toBe('status_only')
    expect(isTripDetailFieldEditable('scheduled', 'status')).toBe(true)
    expect(isTripDetailFieldEditable('scheduled', 'teamMemberId')).toBe(false)
  })
})

describe('tripDetailAllowsDriverEdit', () => {
  it('allows driver edit when the status lock mode permits teamMemberId', () => {
    expect(tripDetailAllowsDriverEdit('new')).toBe(true)
    expect(tripDetailAllowsDriverEdit('approved')).toBe(true)
    expect(tripDetailAllowsDriverEdit('paid')).toBe(true)
    expect(tripDetailAllowsDriverEdit('scheduled')).toBe(false)
    expect(tripDetailAllowsDriverEdit('completed')).toBe(false)
  })
})

describe('isTripDriverChangeAllowed', () => {
  const driverA = '11111111-1111-4111-8111-111111111111'
  const driverB = '22222222-2222-4222-8222-222222222222'

  it('allows resubmitting the same driver while status is locked', () => {
    expect(
      isTripDriverChangeAllowed({
        currentStatus: 'scheduled',
        currentTeamMemberId: driverA,
        nextTeamMemberId: driverA,
      }),
    ).toBe(true)
  })

  it('blocks driver changes while staying on scheduled', () => {
    expect(
      isTripDriverChangeAllowed({
        currentStatus: 'scheduled',
        currentTeamMemberId: driverA,
        nextTeamMemberId: driverB,
      }),
    ).toBe(false)
  })

  it('evaluates locks against the target status when status changes in the same update', () => {
    expect(
      isTripDriverChangeAllowed({
        currentStatus: 'scheduled',
        nextStatus: 'new',
        currentTeamMemberId: driverA,
        nextTeamMemberId: driverB,
      }),
    ).toBe(true)
  })

  it('still blocks driver changes when moving into a locking status', () => {
    expect(
      isTripDriverChangeAllowed({
        currentStatus: 'new',
        nextStatus: 'scheduled',
        currentTeamMemberId: driverA,
        nextTeamMemberId: driverB,
      }),
    ).toBe(false)
  })
})

describe('isCompletedTripReceiptSupplementUpdate', () => {
  it('allows metadata-only receipt attach on completed trips without a receipt', () => {
    expect(
      isCompletedTripReceiptSupplementUpdate('completed', false, {
        id: 'trip-1',
        metadata: { receiptAttachmentId: 'att-1', receiptDocumentNumber: 'FV/1' },
      }),
    ).toBe(true)
  })

  it('rejects when a receipt is already attached', () => {
    expect(
      isCompletedTripReceiptSupplementUpdate('completed', true, {
        id: 'trip-1',
        metadata: { receiptAttachmentId: 'att-1' },
      }),
    ).toBe(false)
  })

  it('rejects when other trip fields are also updated', () => {
    expect(
      isCompletedTripReceiptSupplementUpdate('completed', false, {
        id: 'trip-1',
        revenueAmount: 100,
        metadata: { receiptAttachmentId: 'att-1' },
      }),
    ).toBe(false)
  })

  it('rejects cancelled trips', () => {
    expect(
      isCompletedTripReceiptSupplementUpdate('cancelled', false, {
        id: 'trip-1',
        metadata: { receiptAttachmentId: 'att-1' },
      }),
    ).toBe(false)
  })
})
