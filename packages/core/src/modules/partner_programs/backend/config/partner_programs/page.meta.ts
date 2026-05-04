import React from 'react'

const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' }),
  React.createElement('circle', { cx: 9, cy: 7, r: 4 }),
  React.createElement('path', { d: 'M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['partner_programs.settings.manage'],
  pageTitle: 'Partner programs settings',
  pageTitleKey: 'partner_programs.config.nav.title',
  pageGroup: 'Module Configs',
  pageGroupKey: 'settings.sections.moduleConfigs',
  pageOrder: 61,
  icon,
  pageContext: 'settings' as const,
  breadcrumb: [
    { label: 'Partner programs settings', labelKey: 'partner_programs.config.nav.title' },
  ],
} as const
