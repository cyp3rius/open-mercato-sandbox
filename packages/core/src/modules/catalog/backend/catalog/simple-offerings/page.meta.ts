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
  React.createElement('path', { d: 'M20 7H4' }),
  React.createElement('path', { d: 'M10 11v6' }),
  React.createElement('path', { d: 'M14 11v6' }),
  React.createElement('path', { d: 'M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12' }),
  React.createElement('path', { d: 'M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['catalog.simple_offerings.view'],
  pageTitle: 'Simple offerings',
  pageTitleKey: 'catalog.simpleOfferings.nav.title',
  pageGroup: 'Customers',
  pageGroupKey: 'customers.nav.group',
  pagePriority: 10,
  pageOrder: 125,
  icon,
  breadcrumb: [{ label: 'Simple offerings', labelKey: 'catalog.simpleOfferings.nav.title' }],
} as const
