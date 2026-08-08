import type { PricingConfig, ServiceType, VehicleCategory } from './types'

export interface VehicleSelection {
  category: VehicleCategory
  warnings: string[]
}

export function selectVehicle(
  config: PricingConfig,
  serviceType: ServiceType,
  passengers: number,
  handLuggage: number,
  holdLuggage = 0,
): VehicleSelection {
  const { vehicleSelection } = config
  const warnings: string[] = []

  if (serviceType === 'local') {
    const { standard, van } = vehicleSelection.local
    if (passengers <= standard.maxPassengers) {
      return { category: 'standard', warnings }
    }
    warnings.push(van.passengersVanUpgradeWarningKey ?? 'vehicle.passengersVanUpgrade')
    return { category: 'van', warnings }
  }

  const airport = vehicleSelection.airport

  if (
    airport.standard.fourPassengersRequiresZeroHoldLuggage &&
    passengers === 4 &&
    holdLuggage > 0
  ) {
    warnings.push(
      airport.standard.fourPassengersVanUpgradeWarningKey ?? 'vehicle.fourPassengersVanUpgrade',
    )
    return { category: 'van', warnings }
  }

  if (passengers >= airport.van.minPassengers && passengers <= airport.van.maxPassengers) {
    return { category: 'van', warnings }
  }

  if (passengers === 4 && holdLuggage === 0) {
    return { category: 'standard', warnings }
  }

  const std = airport.standard
  if (
    passengers <= std.maxPassengersWithFullLuggage &&
    holdLuggage <= std.maxHoldLuggage &&
    handLuggage <= std.maxHandLuggage
  ) {
    return { category: 'standard', warnings }
  }

  if (airport.van.upgradeOnLuggageOverflow) {
    warnings.push(airport.van.luggageOverflowWarningKey)
    return { category: 'van', warnings }
  }

  return { category: 'van', warnings }
}
