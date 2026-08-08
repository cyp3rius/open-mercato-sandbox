import type { ServiceType, VehicleCategory } from './types'

export interface QuoteInput {
  serviceType: ServiceType
  passengers: number
  distanceKm: number
  date: string
  time: string
  handLuggage: number
  holdLuggage?: number
  childSeats: number
  boosterSeats: number
  meetAndGreet?: boolean
  englishSpeakingDriver?: boolean
  isPublicHoliday?: boolean
  /** When set (e.g. from taxi vehicle CF), skip automatic vehicle selection. */
  vehicleCategory?: VehicleCategory
}

export interface SurchargeLine {
  code: string
  label: string
  amount: number
}

export interface QuoteResult {
  vehicleCategory: VehicleCategory
  basePrice: number
  surcharges: SurchargeLine[]
  totalPrice: number
  warnings?: string[]
}

export class QuoteValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'QuoteValidationError'
  }
}
