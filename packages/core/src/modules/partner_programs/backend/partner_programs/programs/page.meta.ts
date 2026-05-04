import React from 'react'

const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }),
  React.createElement('circle', { cx: '9', cy: '7', r: '4' }),
  React.createElement('path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['partner_programs.view'],
  pageTitle: 'Partner programs',
  pageTitleKey: 'partner_programs.list.title',
  pageGroup: 'Partner programs',
  pageGroupKey: 'partner_programs.nav.group',
  pageOrder: 115,
  icon,
  breadcrumb: [{ label: 'Partner programs', labelKey: 'partner_programs.list.title' }],
}
