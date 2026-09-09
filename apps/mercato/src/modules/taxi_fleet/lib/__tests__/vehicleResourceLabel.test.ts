import {
  formatVehicleResourceLabel,
  readVehiclePlateFromResourceRow,
  stripPlateFromVehicleName,
} from '../vehicleResourceLabel'

describe('vehicleResourceLabel', () => {
  it('formats name with plate', () => {
    expect(formatVehicleResourceLabel('Toyota', 'WWA 4K32')).toBe('Toyota · WWA 4K32')
    expect(formatVehicleResourceLabel('Toyota', null)).toBe('Toyota')
    expect(formatVehicleResourceLabel(null, 'WWA 4K32')).toBe('WWA 4K32')
    expect(formatVehicleResourceLabel('  ', '  ')).toBe('')
  })

  it('does not repeat plate when name already includes it', () => {
    expect(formatVehicleResourceLabel('KK3666G', 'KK3666G')).toBe('KK3666G')
    expect(formatVehicleResourceLabel('KK 3666G', 'KK3666G')).toBe('KK 3666G')
    expect(formatVehicleResourceLabel('Toyota KK3666G', 'KK3666G')).toBe('Toyota · KK3666G')
    expect(formatVehicleResourceLabel('Toyota · WWA 4K32', 'WWA 4K32')).toBe('Toyota · WWA 4K32')
    expect(formatVehicleResourceLabel('Toyota · WWA4K32', 'WWA 4K32')).toBe('Toyota · WWA 4K32')
  })

  it('strips plate from name for separate display', () => {
    expect(stripPlateFromVehicleName('Toyota · WWA 4K32', 'WWA 4K32')).toBe('Toyota')
    expect(stripPlateFromVehicleName('WWA 4K32', 'WWA 4K32')).toBe('')
    expect(stripPlateFromVehicleName('Toyota', 'WWA 4K32')).toBe('Toyota')
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
