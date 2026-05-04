import React from 'react'

const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20' }),
  React.createElement('path', { d: 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['playbooks.settings.manage'],
  pageTitle: 'Playbooks settings',
  pageTitleKey: 'playbooks.config.nav.title',
  pageGroup: 'Module Configs',
  pageGroupKey: 'settings.sections.moduleConfigs',
  pageOrder: 63,
  icon,
  pageContext: 'settings' as const,
  breadcrumb: [{ label: 'Playbooks settings', labelKey: 'playbooks.config.nav.title' }],
} as const
