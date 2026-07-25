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
  React.createElement('path', { d: 'm11 17 2 2a1 1 0 1 0 3-3' }),
  React.createElement('path', {
    d: 'm14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4',
  }),
  React.createElement('path', { d: 'm21 3 1 11h-2' }),
  React.createElement('path', { d: 'M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3' }),
  React.createElement('path', { d: 'M3 4h8' }),
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
