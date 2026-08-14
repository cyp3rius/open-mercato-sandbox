import {
  formatVehicleResourceLabel,
  readVehiclePlateFromResourceRow,
} from '../vehicleResourceLabel'

describe('vehicleResourceLabel', () => {
  it('formats name with plate', () => {
    expect(formatVehicleResourceLabel('Toyota', 'WWA 4K32')).toBe('Toyota · WWA 4K32')
    expect(formatVehicleResourceLabel('Toyota', null)).toBe('Toyota')
    expect(formatVehicleResourceLabel(null, 'WWA 4K32')).toBe('WWA 4K32')
    expect(formatVehicleResourceLabel('  ', '  ')).toBe('')
  })

  it('reads plate from resource row variants', () => {
    expect(readVehiclePlateFromResourceRow({ cf_vehicle_plate: 'WX 1234' })).toBe('WX 1234')
    expect(
      readVehiclePlateFromResourceRow({
        customFields: { vehicle_plate: 'KR 9A11' },
      }),
    ).toBe('KR 9A11')
    expect(
      readVehiclePlateFromResourceRow({
        customFields: [{ key: 'cf_vehicle_plate', value: 'GD 55AB' }],
      }),
    ).toBe('GD 55AB')
    expect(readVehiclePlateFromResourceRow({ name: 'Only name' })).toBeNull()
  })
})
