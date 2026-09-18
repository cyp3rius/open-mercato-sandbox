import {
  buildConfirmationRedirectUrl,
  buildPaymentCancelUrl,
  buildPaymentConfirmReturnUrl,
} from '../paypal/client'
import type { TaxiFleetPaypalSettings } from '../../taxiFleetSettings'

describe('paypal url helpers', () => {
  const settings: TaxiFleetPaypalSettings = {
    enabled: true,
    clientId: 'id',
    clientSecret: 'secret',
    mode: 'sandbox',
    currency: 'PLN',
    confirmationPageBase: 'https://book.example.com/request-confirmation',
    paymentCancelUrl: '',
  }

  it('builds confirm return URL on CRM', () => {
    expect(buildPaymentConfirmReturnUrl('https://crm.example.com', 'hash-1')).toBe(
      'https://crm.example.com/api/taxi_fleet/trips/payment/confirm/hash-1',
    )
  })

  it('builds cancel URL from confirmation page base', () => {
    expect(
      buildPaymentCancelUrl({
        settings,
        requestId: 'RS-1',
        paymentHash: 'hash-1',
        appBaseUrl: 'https://crm.example.com',
      }),
    ).toBe('https://book.example.com/request-confirmation/RS-1?payment=cancelled')
  })

  it('builds confirmation redirect with query', () => {
    expect(buildConfirmationRedirectUrl(settings, 'RS-1', { payment: 'success' })).toBe(
      'https://book.example.com/request-confirmation/RS-1?payment=success',
    )
  })
})
