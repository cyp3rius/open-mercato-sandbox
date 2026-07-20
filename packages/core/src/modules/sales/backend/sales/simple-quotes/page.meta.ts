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
  React.createElement('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
  React.createElement('path', { d: 'M14 2v6h6' }),
  React.createElement('path', { d: 'M8 13h8' }),
  React.createElement('path', { d: 'M8 17h5' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['sales.simple_quotes.view'],
  pageTitle: 'Quotes',
  pageTitleKey: 'sales.simpleQuotes.nav.title',
  pageGroup: 'Sales',
  pageGroupKey: 'customers~sales.nav.group',
  pagePriority: 40,
  pageOrder: 101,
  icon,
  breadcrumb: [{ label: 'Quotes', labelKey: 'sales.simpleQuotes.nav.title' }],
} as const
