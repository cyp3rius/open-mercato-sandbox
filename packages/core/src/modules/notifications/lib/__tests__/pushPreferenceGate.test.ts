import { resolveEffectivePushPreference } from '../notificationPreferenceService'

jest.mock('../notificationPreferenceDefinitions', () => ({
  resolveNotificationPreferenceDefinition: (notificationType: string) => {
    if (notificationType === 'no.push') {
      return { labelKey: 'x' }
    }
    if (notificationType === 'locked.push') {
      return { labelKey: 'x', pushChannel: { locked: true, defaultEnabled: false } }
    }
    if (notificationType === 'default.off') {
      return { labelKey: 'x', pushChannel: { defaultEnabled: false } }
    }
    if (notificationType === 'default.on') {
      return { labelKey: 'x', pushChannel: { defaultEnabled: true } }
    }
    return undefined
  },
}))

describe('resolveEffectivePushPreference', () => {
  test('returns false when type has no pushChannel', () => {
    expect(
      resolveEffectivePushPreference({
        notificationType: 'no.push',
        storedPushPreferences: new Map(),
      }),
    ).toEqual({ enabled: false, locked: false, hasPushChannel: false })
  })

  test('locked channel always enabled', () => {
    expect(
      resolveEffectivePushPreference({
        notificationType: 'locked.push',
        storedPushPreferences: new Map([['locked.push', false]]),
      }),
    ).toEqual({ enabled: true, locked: true, hasPushChannel: true })
  })

  test('honors stored preference over default', () => {
    expect(
      resolveEffectivePushPreference({
        notificationType: 'default.on',
        storedPushPreferences: new Map([['default.on', false]]),
      }),
    ).toEqual({ enabled: false, locked: false, hasPushChannel: true })

    expect(
      resolveEffectivePushPreference({
        notificationType: 'default.off',
        storedPushPreferences: new Map(),
      }),
    ).toEqual({ enabled: false, locked: false, hasPushChannel: true })
  })
})
