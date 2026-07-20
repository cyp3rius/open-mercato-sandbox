import { registerNotificationTypes } from '../notification-types-registry'
import {
  listConfigurableNotificationTypes,
  resolveNotificationPreferenceDefinition,
} from '../notificationPreferenceDefinitions'
import { notificationTypes as salesNotificationTypes } from '../../../sales/notifications'

describe('sales notification preferences', () => {
  beforeAll(() => {
    registerNotificationTypes([...salesNotificationTypes], { replace: true })
  })

  it('exposes every sales notification type as a configurable preference with audience', () => {
    const salesTypes = salesNotificationTypes.map((entry) => entry.type)
    for (const type of salesTypes) {
      const preference = resolveNotificationPreferenceDefinition(type)
      expect(preference).toEqual(
        expect.objectContaining({
          labelKey: expect.stringContaining('sales.notifications.preferences.'),
          audience: expect.stringMatching(/^(global|individual)$/),
        }),
      )
    }

    const listed = new Set(listConfigurableNotificationTypes().map((entry) => entry.type))
    for (const type of salesTypes) {
      expect(listed.has(type)).toBe(true)
    }
  })

  it('splits team fan-out from owner preference channels', () => {
    expect(resolveNotificationPreferenceDefinition('sales.quote.created')).toEqual(
      expect.objectContaining({
        audience: 'global',
        lockFeature: 'sales.quotes.create.notify',
        lockedWhenRoleGrants: true,
      }),
    )
    expect(resolveNotificationPreferenceDefinition('sales.order.created')).toEqual(
      expect.objectContaining({
        audience: 'global',
        lockFeature: 'sales.orders.create.notify',
        lockedWhenRoleGrants: true,
      }),
    )
    expect(resolveNotificationPreferenceDefinition('sales.payment.received')).toEqual(
      expect.objectContaining({
        audience: 'global',
        lockFeature: 'sales.payments.received.notify',
        lockedWhenRoleGrants: true,
      }),
    )
    expect(resolveNotificationPreferenceDefinition('sales.quote.expiring')).toEqual(
      expect.objectContaining({
        audience: 'global',
        lockFeature: 'sales.quotes.expiring.notify',
        lockedWhenRoleGrants: true,
      }),
    )
    expect(resolveNotificationPreferenceDefinition('sales.quote.owner_assigned')).toEqual(
      expect.objectContaining({
        audience: 'individual',
        scopeFeature: 'sales.quotes.view',
      }),
    )
    expect(resolveNotificationPreferenceDefinition('sales.order.owner_assigned')).toEqual(
      expect.objectContaining({
        audience: 'individual',
        scopeFeature: 'sales.orders.view',
      }),
    )
    expect(resolveNotificationPreferenceDefinition('sales.quote.expiring.owner')).toEqual(
      expect.objectContaining({
        audience: 'individual',
        scopeFeature: 'sales.quotes.view',
      }),
    )
  })
})
