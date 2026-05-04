import React from 'react'

const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M4 4h16v16H4z' }),
  React.createElement('path', { d: 'M8 8h8M8 12h8' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['cases.view'],
  pageTitle: 'Cases',
  pageTitleKey: 'cases.list.title',
  pageGroup: 'CRM',
  pageGroupKey: 'cases.nav.group',
  pageOrder: 112,
  icon,
  breadcrumb: [{ label: 'Cases', labelKey: 'cases.list.title' }],
}
