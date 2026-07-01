import * as React from 'react'
import type { SectionNavGroup } from '@open-mercato/ui/backend/section-page'

const KeyIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
)

const BellIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

export const profileSections: SectionNavGroup[] = [
  {
    id: 'account',
    label: 'Account',
    labelKey: 'profile.sections.account',
    order: 1,
    items: [
      {
        id: 'change-password',
        label: 'Change Password',
        labelKey: 'auth.changePassword.title',
        href: '/backend/profile/change-password',
        icon: KeyIcon,
        order: 1,
      },
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    labelKey: 'profile.sections.notifications',
    order: 2,
    items: [
      {
        id: 'notification-preferences',
        label: 'Notification Preferences',
        labelKey: 'settings.profile.notifications',
        href: '/backend/profile/notifications',
        icon: BellIcon,
        order: 1,
      },
    ],
  },
]

export const profilePathPrefixes = [
  '/backend/profile/',
]

export function isProfilePath(path: string): boolean {
  if (path === '/backend/profile') return true
  return profilePathPrefixes.some((prefix) => path.startsWith(prefix))
}
