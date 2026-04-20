import React from 'react'

const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M3 3h18v18H3zM9 9h6v6H9z' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['procurement.settings.manage'],
  pageTitle: 'Procurement',
  pageTitleKey: 'procurement.config.nav.title',
  pageGroup: 'Module Configs',
  pageGroupKey: 'settings.sections.moduleConfigs',
  pageOrder: 48,
  icon,
  pageContext: 'settings' as const,
  breadcrumb: [{ label: 'Procurement', labelKey: 'procurement.config.nav.title' }],
} as const
