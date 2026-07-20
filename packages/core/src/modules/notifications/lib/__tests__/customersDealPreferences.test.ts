import { registerNotificationTypes } from '../notification-types-registry'
import {
  listConfigurableNotificationTypes,
  resolveNotificationPreferenceDefinition,
} from '../notificationPreferenceDefinitions'
import { notificationTypes as customersNotificationTypes } from '../../../customers/notifications'

describe('customers deal notification preferences', () => {
  beforeAll(() => {
    registerNotificationTypes([...customersNotificationTypes], { replace: true })
  })

  it('exposes deal create as global and owner channels as individual', () => {
    expect(resolveNotificationPreferenceDefinition('customers.deal.created')).toEqual(
      expect.objectContaining({
        audience: 'global',
        lockFeature: 'customers.deals.create.notify',
        lockedWhenRoleGrants: true,
      }),
    )
    expect(resolveNotificationPreferenceDefinition('customers.deal.owner_assigned')).toEqual(
      expect.objectContaining({
        audience: 'individual',
        scopeFeature: 'customers.deals.view',
      }),
    )
    expect(resolveNotificationPreferenceDefinition('customers.deal.won')?.audience).toBe('individual')
    expect(resolveNotificationPreferenceDefinition('customers.deal.lost')?.audience).toBe('individual')

    const listed = new Set(listConfigurableNotificationTypes().map((entry) => entry.type))
    expect(listed.has('customers.deal.created')).toBe(true)
    expect(listed.has('customers.deal.owner_assigned')).toBe(true)
  })

  it('assigns audience on every customers notification type', () => {
    for (const entry of customersNotificationTypes) {
      expect(resolveNotificationPreferenceDefinition(entry.type)?.audience).toMatch(
        /^(global|individual)$/,
      )
    }
  })
})
