import { resolveSelfStartAssignmentRow } from '../assignmentValidation'

const R1 = '11111111-1111-4111-8111-111111111111'
const R2 = '22222222-2222-4222-8222-222222222222'
const M1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const M2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function row(partial: {
  id: string
  teamMemberId: string
  resourceId: string
  deletedAt?: Date | null
  status?: 'planned' | 'confirmed' | 'completed' | 'cancelled'
}) {
  return {
    id: partial.id,
    teamMemberId: partial.teamMemberId,
    resourceId: partial.resourceId,
    deletedAt: partial.deletedAt ?? null,
    status: partial.status ?? 'planned',
  } as never
}

describe('resolveSelfStartAssignmentRow', () => {
  it('reclaims soft-deleted resource assignment and drops other ghosts', () => {
    const softResource = row({
      id: '1',
      teamMemberId: M2,
      resourceId: R1,
      deletedAt: new Date(),
    })
    const softMember = row({
      id: '2',
      teamMemberId: M1,
      resourceId: R2,
      deletedAt: new Date(),
    })
    const result = resolveSelfStartAssignmentRow({
      blockers: [softResource, softMember],
      teamMemberId: M1,
      resourceId: R1,
    })
    expect(result).toEqual({
      ok: true,
      row: softResource,
      remove: [softMember],
    })
  })

  it('returns null row when no blockers', () => {
    expect(
      resolveSelfStartAssignmentRow({
        blockers: [],
        teamMemberId: M1,
        resourceId: R1,
      }),
    ).toEqual({ ok: true, row: null, remove: [] })
  })

  it('rejects active foreign resource assignment', () => {
    expect(
      resolveSelfStartAssignmentRow({
        blockers: [row({ id: '1', teamMemberId: M2, resourceId: R1, status: 'confirmed' })],
        teamMemberId: M1,
        resourceId: R1,
      }),
    ).toEqual({ ok: false, conflict: 'resource' })
  })

  it('reclaims cancelled assignment for the same resource', () => {
    const cancelled = row({
      id: '1',
      teamMemberId: M2,
      resourceId: R1,
      status: 'cancelled',
    })
    expect(
      resolveSelfStartAssignmentRow({
        blockers: [cancelled],
        teamMemberId: M1,
        resourceId: R1,
      }),
    ).toEqual({ ok: true, row: cancelled, remove: [] })
  })

  it('reclaims completed (ended) assignment for a new ad-hoc shift', () => {
    const ended = {
      ...row({
        id: '1',
        teamMemberId: M1,
        resourceId: R1,
        status: 'completed',
      }),
      shiftEnd: new Date(),
    } as never
    expect(
      resolveSelfStartAssignmentRow({
        blockers: [ended],
        teamMemberId: M1,
        resourceId: R1,
      }),
    ).toEqual({ ok: true, row: ended, remove: [] })
  })
})
