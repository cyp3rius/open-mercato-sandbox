export type ServiceType = 'airport' | 'local'

export type VehicleCategory = 'standard' | 'van'

export type DistanceRounding = 'ceil'

export type PercentSurchargePolicy = 'maxOne' | 'stack'

export interface BookingConfig {
  minAdvanceHours: number
}

export interface PassengersConfig {
  min: number
  max: number
}

export interface DistanceConfig {
  rounding: DistanceRounding
}

export interface AirportStandardVehicleConfig {
  maxPassengersWithFullLuggage: number
  maxHoldLuggage: number
  maxHandLuggage: number
  fourPassengersRequiresZeroHoldLuggage: boolean
  fourPassengersVanUpgradeWarningKey?: string
}

export interface AirportVanVehicleConfig {
  minPassengers: number
  maxPassengers: number
  upgradeOnLuggageOverflow: boolean
  luggageOverflowWarningKey: string
}

export interface LocalStandardVehicleConfig {
  maxPassengers: number
}

export interface LocalVanVehicleConfig {
  minPassengers: number
  maxPassengers: number
  passengersVanUpgradeWarningKey?: string
}

export interface VehicleSelectionConfig {
  airport: {
    standard: AirportStandardVehicleConfig
    van: AirportVanVehicleConfig
  }
  local: {
    standard: LocalStandardVehicleConfig
    van: LocalVanVehicleConfig
  }
}

export interface TariffConfig {
  serviceType: ServiceType
  vehicleCategory: VehicleCategory
  minimumFare: number
  includedKm: number
  ratePerKm: number
}

export interface NightTimeRangeConfig {
  start: string
  end: string
  endExclusive: boolean
}

export interface NightPercentSurchargeConfig {
  code: 'NIGHT'
  rate: number
  timeRange: NightTimeRangeConfig
}

export interface HolidayPercentSurchargeConfig {
  code: 'HOLIDAY'
  rate: number
  includesSunday: boolean
  includesPublicHolidays: boolean
  country: string
}

export type PercentSurchargeItemConfig = NightPercentSurchargeConfig | HolidayPercentSurchargeConfig

export interface PercentSurchargesConfig {
  policy: PercentSurchargePolicy
  priority: Array<'NIGHT' | 'HOLIDAY'>
  items: PercentSurchargeItemConfig[]
}

export interface MeetGreetSurchargeConfig {
  code: 'MEET_GREET'
  amount: number
  serviceTypes: ServiceType[]
  booleanField: 'meetAndGreet'
}

export interface ChildSeatSurchargeConfig {
  code: 'CHILD_SEAT'
  amountPerUnit: number
  countField: 'childSeats'
}

export interface BoosterSurchargeConfig {
  code: 'BOOSTER'
  amountPerUnit: number
  countField: 'boosterSeats'
}

export type FixedSurchargeConfig = MeetGreetSurchargeConfig | ChildSeatSurchargeConfig | BoosterSurchargeConfig

export interface RoundingConfig {
  moneyDecimalPlaces: number
}

export interface PricingConfig {
  version: string
  currency: string
  passengers: PassengersConfig
  distance: DistanceConfig
  vehicleSelection: VehicleSelectionConfig
  tariffs: TariffConfig[]
  booking: BookingConfig
  percentSurcharges: PercentSurchargesConfig
  fixedSurcharges: FixedSurchargeConfig[]
  calculationOrder: Array<'basePrice' | 'percentSurcharges' | 'fixedSurcharges'>
  rounding: RoundingConfig
}
