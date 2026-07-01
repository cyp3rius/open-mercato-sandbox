export const metadata = {
  requireAuth: true,
  navHidden: true,
  pageTitle: 'Notification Preferences',
  pageTitleKey: 'settings.profile.notifications',
  pageContext: 'profile' as const,
  breadcrumb: [
    { label: 'Profile', labelKey: 'profile.page.title', href: '/backend/profile' },
    { label: 'Notification Preferences', labelKey: 'settings.profile.notifications' },
  ],
}
