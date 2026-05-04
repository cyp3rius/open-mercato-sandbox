import React from 'react'

const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M4 19.5A2.5 2.5 0 016.5 17H20' }),
  React.createElement('path', { d: 'M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['playbooks.view'],
  pageTitle: 'Playbooks',
  pageTitleKey: 'playbooks.list.title',
  pageGroup: 'CRM',
  pageGroupKey: 'cases.nav.group',
  pageOrder: 113,
  icon,
  breadcrumb: [{ label: 'Playbooks', labelKey: 'playbooks.list.title' }],
}
