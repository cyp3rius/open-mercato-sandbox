import {
  applyTripPatchToItems,
  filterCachedTripsForLocalDay,
  mergeCachedItemsById,
  normalizeCachedItemList,
  paginateCachedItems,
  synthesizeMeFromFleetProfile,
} from '../driverDataCache'
import { isLikelyNetworkFailure } from '../queueOrSendTripUpdate'

describe('driverDataCache helpers', () => {
  it('normalizes array and { items } shapes', () => {
    expect(normalizeCachedItemList([{ id: 'a' }])).toEqual([{ id: 'a' }])
    expect(normalizeCachedItemList({ items: [{ id: 'b' }] })).toEqual([{ id: 'b' }])
    expect(normalizeCachedItemList(null)).toEqual([])
  })

  it('merges by id keeping unmatched existing rows', () => {
    const merged = mergeCachedItemsById(
      [
        { id: '1', status: 'scheduled' },
        { id: '2', status: 'completed' },
      ],
      [{ id: '1', status: 'in_progress' }],
    )
    expect(merged).toEqual(
      expect.arrayContaining([
        { id: '1', status: 'in_progress' },
        { id: '2', status: 'completed' },
      ]),
    )
    expect(merged).toHaveLength(2)
  })

  it('patches an existing trip and inserts when missing', () => {
    const patched = applyTripPatchToItems(
      [{ id: '1', status: 'scheduled' }],
      '1',
      { status: 'in_progress', startedAt: '2026-03-20T10:00:00.000Z' },
    )
    expect(patched[0]).toMatchObject({
      id: '1',
      status: 'in_progress',
      startedAt: '2026-03-20T10:00:00.000Z',
    })
    const inserted = applyTripPatchToItems([], '9', { status: 'completed' })
    expect(inserted[0]).toMatchObject({ id: '9', status: 'completed' })
  })

  it('filters trips for local day and paginates', () => {
    const dayStart = new Date(2026, 2, 20, 0, 0, 0, 0)
    const dayEnd = new Date(2026, 2, 20, 23, 59, 59, 999)
    const items = [
      { id: '1', startedAt: '2026-03-20T12:00:00.000Z' },
      { id: '2', startedAt: '2026-03-19T12:00:00.000Z' },
      { id: '3' },
    ]
    const filtered = filterCachedTripsForLocalDay(items, dayStart, dayEnd)
    expect(filtered.map((row) => row.id)).toEqual(expect.arrayContaining(['1', '3']))
    expect(filtered.map((row) => row.id)).not.toContain('2')
    expect(paginateCachedItems([1, 2, 3, 4], 2, 2)).toEqual({
      items: [3, 4],
      page: 2,
      pageSize: 2,
      total: 4,
    })
  })

  it('synthesizes a minimal /me from a fleet profile row', () => {
    const me = synthesizeMeFromFleetProfile({
      id: 'profile-1',
      teamMemberId: 'member-1',
      userId: 'user-1',
      displayName: 'Ada Driver',
      defaultResourceId: 'res-1',
      defaultResourceIds: [
        { id: 'res-1', label: 'Toyota KK123', name: 'Toyota', plate: 'KK123', available: true },
      ],
    })
    expect(me).toMatchObject({
      member: { id: 'member-1', displayName: 'Ada Driver', userId: 'user-1' },
      profile: {
        id: 'profile-1',
        defaultResourceId: 'res-1',
        externalAppEnabled: true,
      },
      todayAssignment: null,
    })
    expect((me.profile as { defaultResourceIds: unknown[] }).defaultResourceIds).toHaveLength(1)
  })
})

describe('isLikelyNetworkFailure', () => {
  it('detects 5xx and fetch failures', () => {
    expect(isLikelyNetworkFailure(null, 503)).toBe(true)
    expect(isLikelyNetworkFailure(new TypeError('Failed to fetch'))).toBe(true)
    expect(isLikelyNetworkFailure(null, 409)).toBe(false)
    expect(isLikelyNetworkFailure(new Error('validation failed'), 400)).toBe(false)
  })
})
