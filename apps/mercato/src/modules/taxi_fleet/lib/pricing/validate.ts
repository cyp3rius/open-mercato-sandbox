import type { PricingConfig } from './types'
import type { QuoteInput } from './quote-types'
import { QuoteValidationError } from './quote-types'

export function validateQuoteInput(input: QuoteInput, config: PricingConfig): void {
  const { passengers } = config

  if (input.passengers < passengers.min || input.passengers > passengers.max) {
    throw new QuoteValidationError(
      'PASSENGERS_RANGE',
      `Liczba pasażerów musi być od ${passengers.min} do ${passengers.max}`,
    )
  }

  if (input.distanceKm <= 0) {
    throw new QuoteValidationError('DISTANCE_INVALID', 'Podaj prawidłowy dystans')
  }

  if (input.handLuggage > input.passengers) {
    throw new QuoteValidationError(
      'HAND_LUGGAGE_EXCEEDS_PASSENGERS',
      'Liczba bagaży podręcznych nie może przekraczać liczby pasażerów',
    )
  }

  const holdLuggage = input.holdLuggage ?? 0
  if (holdLuggage > input.passengers) {
    throw new QuoteValidationError(
      'HOLD_LUGGAGE_EXCEEDS_PASSENGERS',
      'Liczba walizek do luku nie może przekraczać liczby pasażerów',
    )
  }

  if (input.serviceType === 'local' && holdLuggage > 0) {
    throw new QuoteValidationError('LOCAL_HOLD_LUGGAGE', 'Kurs lokalny – tylko bagaż podręczny')
  }

  if (input.childSeats + input.boosterSeats > input.passengers) {
    throw new QuoteValidationError(
      'SEATS_EXCEED_PASSENGERS',
      'Liczba fotelików nie może przekraczać liczby pasażerów',
    )
  }
}
