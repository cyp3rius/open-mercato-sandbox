import { reminderWindowFor } from '../reminders'
import { buildDriverPushTag, buildDriverTripPushUrl } from '../pushPayload'
import { isWebPushConfigured, isWebPushEnabled, resolveWebPushVapidConfig } from '../vapid'

describe('driver push helpers', () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  test('buildDriverTripPushUrl encodes trip id', () => {
    expect(buildDriverTripPushUrl('abc-123')).toBe('/driver/trips/abc-123')
  })

  test('buildDriverPushTag is stable per kind+trip', () => {
    expect(buildDriverPushTag('trip_assigned', 't1')).toBe('taxi_fleet:trip_assigned:t1')
    expect(buildDriverPushTag('trip_reminder', 't1')).toBe('taxi_fleet:trip_reminder:t1')
  })

  test('reminderWindowFor centers on now+1h with ±5 minutes', () => {
    const now = new Date('2026-09-14T12:00:00.000Z')
    const { from, to } = reminderWindowFor(now)
    expect(from.toISOString()).toBe('2026-09-14T12:55:00.000Z')
    expect(to.toISOString()).toBe('2026-09-14T13:05:00.000Z')
  })

  test('WEB_PUSH_ENABLED defaults to off even with VAPID keys', () => {
    delete process.env.WEB_PUSH_ENABLED
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY = 'pub'
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY = 'priv'
    expect(isWebPushEnabled()).toBe(false)
    expect(isWebPushConfigured()).toBe(false)
    expect(resolveWebPushVapidConfig()).toBeNull()
  })

  test('resolveWebPushVapidConfig requires enabled flag plus public+private keys', () => {
    process.env.WEB_PUSH_ENABLED = 'true'
    delete process.env.WEB_PUSH_VAPID_PUBLIC_KEY
    delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY
    delete process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY
    expect(isWebPushEnabled()).toBe(true)
    expect(isWebPushConfigured()).toBe(false)
    expect(resolveWebPushVapidConfig()).toBeNull()

    process.env.WEB_PUSH_VAPID_PUBLIC_KEY = 'pub'
    process.env.WEB_PUSH_VAPID_PRIVATE_KEY = 'priv'
    process.env.WEB_PUSH_VAPID_SUBJECT = 'mailto:ops@example.com'
    expect(isWebPushConfigured()).toBe(true)
    expect(resolveWebPushVapidConfig()).toEqual({
      publicKey: 'pub',
      privateKey: 'priv',
      subject: 'mailto:ops@example.com',
    })
  })
})
