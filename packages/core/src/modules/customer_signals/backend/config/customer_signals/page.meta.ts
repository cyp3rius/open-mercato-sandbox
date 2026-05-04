import React from 'react'

const icon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 },
  React.createElement('path', { d: 'M22 12h-4l-3 9L9 3l-3 9H2' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['customer_signals.settings.manage'],
  pageTitle: 'Customer signals settings',
  pageTitleKey: 'customer_signals.config.nav.title',
  pageGroup: 'Module Configs',
  pageGroupKey: 'settings.sections.moduleConfigs',
  pageOrder: 62,
  icon,
  pageContext: 'settings' as const,
  breadcrumb: [
    { label: 'Customer signals settings', labelKey: 'customer_signals.config.nav.title' },
  ],
} as const
