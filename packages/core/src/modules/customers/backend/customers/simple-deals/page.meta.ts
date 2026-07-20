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
  React.createElement('path', { d: 'M3 7h18' }),
  React.createElement('path', { d: 'M3 7a2 2 0 0 0-2 2v7a4 4 0 0 0 4 4h14a4 4 0 0 0 4-4V9a2 2 0 0 0-2-2' }),
  React.createElement('path', { d: 'M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['customers.simple_deals.view'],
  pageTitle: 'Deals',
  pageTitleKey: 'customers.simpleDeals.nav.title',
  pageGroup: 'Sales',
  pageGroupKey: 'customers~sales.nav.group',
  pagePriority: 40,
  pageOrder: 85,
  icon,
  breadcrumb: [{ label: 'Deals', labelKey: 'customers.simpleDeals.nav.title' }],
} as const
