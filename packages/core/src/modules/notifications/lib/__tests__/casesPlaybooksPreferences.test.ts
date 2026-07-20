import { registerNotificationTypes } from '../notification-types-registry'
import {
  listConfigurableNotificationTypes,
  resolveNotificationPreferenceDefinition,
} from '../notificationPreferenceDefinitions'
import { notificationTypes as casesNotificationTypes } from '../../../cases/notifications'
import { notificationTypes as playbooksNotificationTypes } from '../../../playbooks/notifications'

describe('cases and playbooks notification preferences', () => {
  beforeAll(() => {
    registerNotificationTypes([...casesNotificationTypes, ...playbooksNotificationTypes], { replace: true })
  })

  it('exposes every cases notification type as a configurable preference', () => {
    const casesTypes = casesNotificationTypes.map((entry) => entry.type)
    for (const type of casesTypes) {
      expect(resolveNotificationPreferenceDefinition(type)).toEqual(
        expect.objectContaining({
          labelKey: expect.stringContaining('cases.notifications.preferences.'),
          audience: expect.stringMatching(/^(global|individual)$/),
        }),
      )
    }

    const listed = new Set(listConfigurableNotificationTypes().map((entry) => entry.type))
    for (const type of casesTypes) {
      expect(listed.has(type)).toBe(true)
    }
  })

  it('splits lifecycle events into role-driven global and preference-driven owner channels', () => {
    expect(resolveNotificationPreferenceDefinition('cases.case.created')).toEqual(
      expect.objectContaining({
        audience: 'global',
        lockFeature: 'cases.cases.create.notify',
        lockedWhenRoleGrants: true,
      }),
    )
    expect(resolveNotificationPreferenceDefinition('cases.case.created.owner')).toEqual(
      expect.objectContaining({
        audience: 'individual',
        scopeFeature: 'cases.view',
      }),
    )
    expect(resolveNotificationPreferenceDefinition('cases.case.overdue')?.audience).toBe('global')
    expect(resolveNotificationPreferenceDefinition('cases.case.overdue.owner')?.audience).toBe('individual')
    expect(resolveNotificationPreferenceDefinition('cases.case.closed')?.audience).toBe('global')
    expect(resolveNotificationPreferenceDefinition('cases.case.closed.owner')?.audience).toBe('individual')
    expect(resolveNotificationPreferenceDefinition('cases.case.stage_owner_assigned')?.audience).toBe('individual')
    expect(resolveNotificationPreferenceDefinition('cases.procedure.action_notify')?.audience).toBe('individual')
  })

  it('exposes every playbooks notification type as role-driven global preferences', () => {
    expect(resolveNotificationPreferenceDefinition('playbooks.playbook.created')).toEqual(
      expect.objectContaining({
        labelKey: 'playbooks.notifications.preferences.playbook_created',
        scopeFeature: 'playbooks.playbook.created.notify',
        lockFeature: 'playbooks.playbook.created.notify',
        lockedWhenRoleGrants: true,
        audience: 'global',
      }),
    )
    expect(resolveNotificationPreferenceDefinition('playbooks.playbook.version_published')).toEqual(
      expect.objectContaining({
        labelKey: 'playbooks.notifications.preferences.playbook_version_published',
        scopeFeature: 'playbooks.playbook.version_published.notify',
        lockFeature: 'playbooks.playbook.version_published.notify',
        lockedWhenRoleGrants: true,
        audience: 'global',
      }),
    )

    const listed = new Set(listConfigurableNotificationTypes().map((entry) => entry.type))
    expect(listed.has('playbooks.playbook.created')).toBe(true)
    expect(listed.has('playbooks.playbook.version_published')).toBe(true)
  })
})
