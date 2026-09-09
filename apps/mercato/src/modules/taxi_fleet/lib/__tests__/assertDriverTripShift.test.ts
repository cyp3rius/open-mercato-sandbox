import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { assertDriverTripShift } from '../assertDriverTripShift'

jest.mock('@open-mercato/shared/lib/encryption/find', () => ({
  findWithDecryption: jest.fn(),
  findOneWithDecryption: jest.fn(),
}))

jest.mock('../taxiFleetOrganizationSettings', () => ({
  loadTaxiFleetOrganizationSettings: jest.fn(async () => ({
    calendar: { timezone: 'UTC' },
  })),
}))

const { findWithDecryption, findOneWithDecryption } = jest.requireMock(
  '@open-mercato/shared/lib/encryption/find',
) as {
  findWithDecryption: jest.Mock
  findOneWithDecryption: jest.Mock
}

describe('assertDriverTripShift', () => {
  const translate = (key: string, fallback?: string) => fallback ?? key
  const em = {} as never
  const base = {
    em,
    tenantId: 't1',
    organizationId: 'o1',
    teamMemberId: 'm1',
    translate,
  }

  beforeEach(() => {
    findWithDecryption.mockReset()
    findOneWithDecryption.mockReset()
  })

  it('allows scheduled trips in the future using day assignment vehicle', async () => {
    findWithDecryption.mockResolvedValue([
      {
        id: 'a1',
        resourceId: 'r1',
        assignmentDate: '2026-09-10',
        status: 'planned',
        shiftStart: null,
        shiftEnd: null,
        plannedShiftStart: '2026-09-10T06:00:00.000Z',
        plannedShiftEnd: '2026-09-10T14:00:00.000Z',
      },
    ])
    const binding = await assertDriverTripShift({
      ...base,
      mode: 'scheduled',
      startedAt: new Date('2026-09-10T09:00:00.000Z'),
      now: new Date('2026-09-09T12:00:00.000Z'),
    })
    expect(binding).toEqual({ assignmentId: 'a1', resourceId: 'r1' })
  })

  it('falls back to default vehicle for scheduled trips without day assignment', async () => {
    findWithDecryption.mockResolvedValue([])
    findOneWithDecryption.mockResolvedValue({
      defaultResourceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })
    const binding = await assertDriverTripShift({
      ...base,
      mode: 'scheduled',
      startedAt: new Date('2026-09-12T09:00:00.000Z'),
      now: new Date('2026-09-09T12:00:00.000Z'),
    })
    expect(binding).toEqual({
      assignmentId: null,
      resourceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })
  })

  it('falls back to first defaultResourceIds entry for scheduled trips', async () => {
    findWithDecryption.mockResolvedValue([])
    findOneWithDecryption.mockResolvedValue({
      defaultResourceIds: [
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      ],
      defaultResourceId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    })
    const binding = await assertDriverTripShift({
      ...base,
      mode: 'scheduled',
      startedAt: new Date('2026-09-12T09:00:00.000Z'),
      now: new Date('2026-09-09T12:00:00.000Z'),
    })
    expect(binding).toEqual({
      assignmentId: null,
      resourceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    })
  })

  it('rejects past-mode trips with future startedAt', async () => {
    findWithDecryption.mockResolvedValue([])
    await expect(
      assertDriverTripShift({
        ...base,
        mode: 'past',
        startedAt: new Date('2026-09-12T09:00:00.000Z'),
        endedAt: new Date('2026-09-12T10:00:00.000Z'),
        now: new Date('2026-09-09T12:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(CrudHttpError)
  })

  it('rejects live mode without open shift', async () => {
    findWithDecryption.mockResolvedValue([
      {
        id: 'a1',
        resourceId: 'r1',
        assignmentDate: '2026-09-09',
        status: 'planned',
        shiftStart: null,
        shiftEnd: null,
      },
    ])
    await expect(
      assertDriverTripShift({
        ...base,
        mode: 'live',
        startedAt: new Date('2026-09-09T12:00:00.000Z'),
        now: new Date('2026-09-09T12:00:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(CrudHttpError)
  })
})
