import React from 'react'

const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M4 6h16v12H4zM8 10h8M8 14h5' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['cases.settings.manage'],
  pageTitle: 'Cases settings',
  pageTitleKey: 'cases.config.nav.title',
  pageGroup: 'Module Configs',
  pageGroupKey: 'settings.sections.moduleConfigs',
  pageOrder: 60,
  icon,
  pageContext: 'settings' as const,
  breadcrumb: [{ label: 'Cases settings', labelKey: 'cases.config.nav.title' }],
} as const
