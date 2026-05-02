import React from 'react'

const icon = React.createElement(
  'svg',
  {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  },
  React.createElement('circle', { cx: 12, cy: 12, r: 3 }),
  React.createElement('path', { d: 'M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42' }),
)

export const metadata = {
  requireAuth: true,
  /** Dopasowane do huba księgowości (lista w sekcji Ustawień w sidebarze). */
  requireFeatures: ['accounting.invoices.view'],
  pageTitle: 'Accounting settings',
  pageTitleKey: 'accounting.settings.hub.title',
  pageGroup: 'Accounting',
  pageGroupKey: 'accounting.nav.group',
  pageOrder: 47,
  icon,
  pageContext: 'settings' as const,
  navHidden: false,
  breadcrumb: [
    { label: 'Accounting', labelKey: 'accounting.hub.title', href: '/backend/accounting' },
    { label: 'Settings', labelKey: 'accounting.settings.hub.title', href: '/backend/config/accounting' },
  ],
}
