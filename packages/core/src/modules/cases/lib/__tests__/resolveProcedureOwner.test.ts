import { resolveInvokeProcedureOwner } from '../resolveProcedureOwner'

describe('resolveInvokeProcedureOwner', () => {
  it('uses manual owner when assign feature is granted', () => {
    expect(
      resolveInvokeProcedureOwner({
        mayAssign: true,
        requestedOwnerUserId: '11111111-1111-4111-8111-111111111111',
        recommendedOwnerUserIds: ['22222222-2222-4222-8222-222222222222'],
        parentOwnerUserId: '33333333-3333-4333-8333-333333333333',
      }),
    ).toBe('11111111-1111-4111-8111-111111111111')
  })

  it('ignores manual owner without assign feature and uses first recommended', () => {
    expect(
      resolveInvokeProcedureOwner({
        mayAssign: false,
        requestedOwnerUserId: '11111111-1111-4111-8111-111111111111',
        recommendedOwnerUserIds: [
          '22222222-2222-4222-8222-222222222222',
          '44444444-4444-4444-8444-444444444444',
        ],
        parentOwnerUserId: '33333333-3333-4333-8333-333333333333',
      }),
    ).toBe('22222222-2222-4222-8222-222222222222')
  })

  it('falls back to parent owner when recommended list is empty', () => {
    expect(
      resolveInvokeProcedureOwner({
        mayAssign: false,
        recommendedOwnerUserIds: [],
        parentOwnerUserId: '33333333-3333-4333-8333-333333333333',
      }),
    ).toBe('33333333-3333-4333-8333-333333333333')
  })

  it('returns null when no owner can be resolved', () => {
    expect(
      resolveInvokeProcedureOwner({
        mayAssign: false,
        recommendedOwnerUserIds: ['', '  '],
        parentOwnerUserId: null,
      }),
    ).toBeNull()
  })
})
