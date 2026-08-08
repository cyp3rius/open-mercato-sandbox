import type { PricingConfig, ServiceType, VehicleCategory } from './types'
import type { QuoteInput, SurchargeLine } from './quote-types'

export function roundMoney(config: PricingConfig, value: number): number {
  const places = config.rounding.moneyDecimalPlaces
  const factor = 10 ** places
  return Math.round(value * factor) / factor
}

function parseTimeMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

function isNightTime(time: string, config: PricingConfig): boolean {
  const nightItem = config.percentSurcharges.items.find((item) => item.code === 'NIGHT')
  const range =
    nightItem?.code === 'NIGHT'
      ? nightItem.timeRange
      : { start: '22:00', end: '06:00', endExclusive: true }
  const minutes = parseTimeMinutes(time)
  const nightStart = parseTimeMinutes(range.start)
  const nightEnd = parseTimeMinutes(range.end)
  if (range.endExclusive) {
    return minutes >= nightStart || minutes < nightEnd
  }
  return minutes >= nightStart || minutes <= nightEnd
}

function isSunday(date: string): boolean {
  const d = new Date(`${date}T12:00:00`)
  return d.getDay() === 0
}

function isHoliday(input: QuoteInput, config: PricingConfig): boolean {
  const holidayConfig = config.percentSurcharges.items.find((item) => item.code === 'HOLIDAY')
  if (!holidayConfig || holidayConfig.code !== 'HOLIDAY') return false

  if (holidayConfig.includesSunday && isSunday(input.date)) return true
  if (holidayConfig.includesPublicHolidays && input.isPublicHoliday) return true
  return false
}

export function computePercentSurcharges(
  config: PricingConfig,
  input: QuoteInput,
  basePrice: number,
): SurchargeLine[] {
  const { percentSurcharges } = config
  const lines: SurchargeLine[] = []

  const nightItem = percentSurcharges.items.find((item) => item.code === 'NIGHT')
  const holidayItem = percentSurcharges.items.find((item) => item.code === 'HOLIDAY')

  const nightActive = nightItem?.code === 'NIGHT' && isNightTime(input.time, config)
  const holidayActive = holidayItem?.code === 'HOLIDAY' && isHoliday(input, config)

  for (const code of percentSurcharges.priority) {
    if (code === 'NIGHT' && nightActive && nightItem?.code === 'NIGHT') {
      lines.push({
        code: 'NIGHT',
        label: 'Dopłata nocna',
        amount: roundMoney(config, basePrice * nightItem.rate),
      })
      if (percentSurcharges.policy === 'maxOne') return lines
    }
    if (code === 'HOLIDAY' && holidayActive && holidayItem?.code === 'HOLIDAY') {
      lines.push({
        code: 'HOLIDAY',
        label: 'Dopłata niedziela/święto',
        amount: roundMoney(config, basePrice * holidayItem.rate),
      })
      if (percentSurcharges.policy === 'maxOne') return lines
    }
  }

  return lines
}

export function computeFixedSurcharges(config: PricingConfig, input: QuoteInput): SurchargeLine[] {
  const { fixedSurcharges } = config
  const lines: SurchargeLine[] = []

  for (const item of fixedSurcharges) {
    if (item.code === 'MEET_GREET') {
      if (input.meetAndGreet && item.serviceTypes.includes(input.serviceType)) {
        lines.push({
          code: item.code,
          label: 'Tabliczka w hali',
          amount: item.amount,
        })
      }
    } else if (item.code === 'CHILD_SEAT') {
      const count = input.childSeats
      if (count > 0) {
        lines.push({
          code: item.code,
          label: `Fotelik (×${count})`,
          amount: roundMoney(config, item.amountPerUnit * count),
        })
      }
    } else if (item.code === 'BOOSTER') {
      const count = input.boosterSeats
      if (count > 0) {
        lines.push({
          code: item.code,
          label: `Podstawka (×${count})`,
          amount: roundMoney(config, item.amountPerUnit * count),
        })
      }
    }
  }

  return lines
}

export function computeBasePrice(
  config: PricingConfig,
  serviceType: ServiceType,
  vehicleCategory: VehicleCategory,
  distanceKm: number,
): number {
  const tariff = config.tariffs.find(
    (entry) => entry.serviceType === serviceType && entry.vehicleCategory === vehicleCategory,
  )
  if (!tariff) {
    throw new Error(`Brak taryfy: ${serviceType}/${vehicleCategory}`)
  }

  if (distanceKm <= tariff.includedKm) {
    return tariff.minimumFare
  }

  const extraKm = distanceKm - tariff.includedKm
  return roundMoney(config, tariff.minimumFare + extraKm * tariff.ratePerKm)
}
