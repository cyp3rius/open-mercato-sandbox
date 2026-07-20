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
  React.createElement('circle', { cx: 12, cy: 12, r: 9 }),
  React.createElement('path', { d: 'M12 7v10' }),
  React.createElement('path', { d: 'M8.5 10.5C8.5 8.57 10 7 12.5 7H14' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['sales.simple_orders.view'],
  pageTitle: 'Orders',
  pageTitleKey: 'sales.simpleOrders.nav.title',
  pageGroup: 'Sales',
  pageGroupKey: 'customers~sales.nav.group',
  pagePriority: 40,
  pageOrder: 91,
  icon,
  breadcrumb: [{ label: 'Orders', labelKey: 'sales.simpleOrders.nav.title' }],
} as const
