import {
  DEFAULT_SUBSCRIPTION_ACTIVATION_ORDER_STATUSES,
  isSubscriptionActivationOrderStatus,
  resolveSubscriptionActivationOrderStatuses,
} from '../subscriptionActivation'

describe('subscriptionActivation', () => {
  it('defaults to confirmed when raw is null or empty', () => {
    expect(resolveSubscriptionActivationOrderStatuses(null)).toEqual([
      ...DEFAULT_SUBSCRIPTION_ACTIVATION_ORDER_STATUSES,
    ])
    expect(resolveSubscriptionActivationOrderStatuses([])).toEqual(['confirmed'])
    expect(resolveSubscriptionActivationOrderStatuses(undefined)).toEqual(['confirmed'])
  })

  it('normalizes, lowercases, and dedupes configured statuses', () => {
    expect(
      resolveSubscriptionActivationOrderStatuses(['Confirmed', ' fulfilled ', 'confirmed', '']),
    ).toEqual(['confirmed', 'fulfilled'])
  })

  it('matches order status against configured list', () => {
    expect(isSubscriptionActivationOrderStatus('confirmed', null)).toBe(true)
    expect(isSubscriptionActivationOrderStatus('fulfilled', null)).toBe(false)
    expect(
      isSubscriptionActivationOrderStatus('Fulfilled', ['confirmed', 'fulfilled']),
    ).toBe(true)
    expect(isSubscriptionActivationOrderStatus('draft', ['confirmed'])).toBe(false)
    expect(isSubscriptionActivationOrderStatus(null, ['confirmed'])).toBe(false)
  })
})
