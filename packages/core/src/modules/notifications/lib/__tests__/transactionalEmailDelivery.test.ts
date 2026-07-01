import {
  registerNotificationDeliveryStrategy,
} from '../deliveryStrategies'
import { resolveFirstEnabledEmailDeliveryStrategy } from '../transactionalEmailDelivery'
import { DEFAULT_NOTIFICATION_DELIVERY_CONFIG } from '../deliveryConfig'

describe('resolveFirstEnabledEmailDeliveryStrategy', () => {
  it('prefers the first enabled custom strategy by priority', () => {
    registerNotificationDeliveryStrategy(
      {
        id: 'test.low-priority',
        deliver: async () => {},
        sendTransactionalEmail: async () => {},
      },
      { priority: 1 },
    )
    registerNotificationDeliveryStrategy(
      {
        id: 'test.high-priority',
        deliver: async () => {},
        sendTransactionalEmail: async () => {},
      },
      { priority: 50 },
    )

    const config = {
      ...DEFAULT_NOTIFICATION_DELIVERY_CONFIG,
      strategies: {
        ...DEFAULT_NOTIFICATION_DELIVERY_CONFIG.strategies,
        email: { ...DEFAULT_NOTIFICATION_DELIVERY_CONFIG.strategies.email, enabled: true },
        custom: {
          'test.low-priority': { enabled: true },
          'test.high-priority': { enabled: true },
        },
      },
    }

    const resolved = resolveFirstEnabledEmailDeliveryStrategy(config)
    expect(resolved?.kind).toBe('custom')
    if (resolved?.kind === 'custom') {
      expect(resolved.strategy.id).toBe('test.high-priority')
    }
  })

  it('falls back to Resend when no custom strategy is enabled', () => {
    const config = {
      ...DEFAULT_NOTIFICATION_DELIVERY_CONFIG,
      strategies: {
        ...DEFAULT_NOTIFICATION_DELIVERY_CONFIG.strategies,
        email: { ...DEFAULT_NOTIFICATION_DELIVERY_CONFIG.strategies.email, enabled: true },
        custom: {},
      },
    }

    const resolved = resolveFirstEnabledEmailDeliveryStrategy(config)
    expect(resolved).toEqual({
      kind: 'resend',
      config: config.strategies.email,
    })
  })

  it('returns null when no strategy is enabled', () => {
    const config = {
      ...DEFAULT_NOTIFICATION_DELIVERY_CONFIG,
      strategies: {
        ...DEFAULT_NOTIFICATION_DELIVERY_CONFIG.strategies,
        email: { ...DEFAULT_NOTIFICATION_DELIVERY_CONFIG.strategies.email, enabled: false },
        custom: {},
      },
    }

    expect(resolveFirstEnabledEmailDeliveryStrategy(config)).toBeNull()
  })
})
