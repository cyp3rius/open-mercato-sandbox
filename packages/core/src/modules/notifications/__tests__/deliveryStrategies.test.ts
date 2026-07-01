import { type NotificationDeliveryStrategy } from '../lib/deliveryStrategies'

const REGISTRY_GLOBAL_KEY = '__openMercatoNotificationDeliveryStrategies__'

describe('notification delivery strategies', () => {
  beforeEach(() => {
    try {
      delete (globalThis as Record<string, unknown>)[REGISTRY_GLOBAL_KEY]
    } catch {
      // ignore
    }
  })

  it('orders strategies by priority', async () => {
    jest.resetModules()
    const { registerNotificationDeliveryStrategy, getNotificationDeliveryStrategies } = await import('../lib/deliveryStrategies')

    const first: NotificationDeliveryStrategy = { id: 'first', deliver: jest.fn() }
    const second: NotificationDeliveryStrategy = { id: 'second', deliver: jest.fn() }
    const third: NotificationDeliveryStrategy = { id: 'third', deliver: jest.fn() }

    registerNotificationDeliveryStrategy(first, { priority: 1 })
    registerNotificationDeliveryStrategy(second, { priority: 10 })
    registerNotificationDeliveryStrategy(third, { priority: 5 })

    const ids = getNotificationDeliveryStrategies().map((strategy) => strategy.id)
    expect(ids).toEqual(['second', 'third', 'first'])
  })

  it('lists strategy descriptors without deliver handlers', async () => {
    jest.resetModules()
    const {
      registerNotificationDeliveryStrategy,
      listNotificationDeliveryStrategyDescriptors,
    } = await import('../lib/deliveryStrategies')

    registerNotificationDeliveryStrategy({
      id: 'nodemailer',
      label: 'Email (Nodemailer)',
      defaultEnabled: true,
      deliver: jest.fn(),
    })

    expect(listNotificationDeliveryStrategyDescriptors()).toEqual([
      { id: 'nodemailer', label: 'Email (Nodemailer)', defaultEnabled: true },
    ])
  })
})
