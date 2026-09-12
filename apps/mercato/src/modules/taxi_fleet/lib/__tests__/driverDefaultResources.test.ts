import {
  buildShiftStartAllowlist,
  normalizeDriverDefaultResources,
  preselectShiftVehicleId,
  resolveDriverDefaultResourceIds,
  resolveShiftStartVehicle,
} from '../driverDefaultResources'

const R1 = '11111111-1111-4111-8111-111111111111'
const R2 = '22222222-2222-4222-8222-222222222222'
const R3 = '33333333-3333-4333-8333-333333333333'

describe('driverDefaultResources', () => {
  it('dual-reads list over singular and dedupes', () => {
    expect(
      resolveDriverDefaultResourceIds({
        defaultResourceIds: [R1, R1, R2, 'not-a-uuid'],
        defaultResourceId: R3,
      }),
    ).toEqual([R1, R2])
  })

  it('falls back to singular when list empty/missing', () => {
    expect(resolveDriverDefaultResourceIds({ defaultResourceId: R2 })).toEqual([R2])
    expect(resolveDriverDefaultResourceIds({ defaultResourceIds: [], defaultResourceId: R2 })).toEqual([
      R2,
    ])
    expect(resolveDriverDefaultResourceIds({})).toEqual([])
  })

  it('dual-writes list + singular primary; clears on empty list', () => {
    expect(normalizeDriverDefaultResources({ defaultResourceIds: [R2, R1] })).toEqual({
      defaultResourceIds: [R2, R1],
      defaultResourceId: R2,
    })
    expect(normalizeDriverDefaultResources({ defaultResourceIds: [] })).toEqual({
      defaultResourceIds: null,
      defaultResourceId: null,
    })
    expect(normalizeDriverDefaultResources({ defaultResourceId: R3 })).toEqual({
      defaultResourceIds: [R3],
      defaultResourceId: R3,
    })
  })

  it('builds allowlist from free defaults only', () => {
    expect(
      buildShiftStartAllowlist({
        defaultResourceIds: [R1, R2, R3],
        busyResourceIds: [R2],
      }),
    ).toEqual([R1, R3])
    expect(
      buildShiftStartAllowlist({
        defaultResourceIds: [R1, R2],
        busyResourceIds: [],
      }),
    ).toEqual([R1, R2])
    expect(
      buildShiftStartAllowlist({
        defaultResourceIds: [R1, R2],
        busyResourceIds: [R1, R2],
      }),
    ).toEqual([])
  })

  it('requires an explicit vehicle from the allowlist', () => {
    expect(resolveShiftStartVehicle({ allowlist: [], requestedResourceId: R1 })).toEqual({
      ok: false,
      code: 'SHIFT_VEHICLE_REQUIRED',
    })
    expect(resolveShiftStartVehicle({ allowlist: [R1, R2], requestedResourceId: null })).toEqual({
      ok: false,
      code: 'SHIFT_VEHICLE_REQUIRED',
    })
    expect(resolveShiftStartVehicle({ allowlist: [R1, R2], requestedResourceId: R3 })).toEqual({
      ok: false,
      code: 'SHIFT_VEHICLE_NOT_ALLOWED',
    })
    expect(resolveShiftStartVehicle({ allowlist: [R1, R2], requestedResourceId: R2 })).toEqual({
      ok: true,
      resourceId: R2,
    })
  })

  it('preselects assignment vehicle when on allowlist', () => {
    expect(preselectShiftVehicleId([R1, R2], R2)).toBe(R2)
    expect(preselectShiftVehicleId([R1, R2], R3)).toBe(R1)
    expect(preselectShiftVehicleId([], R1)).toBe(null)
  })
})
