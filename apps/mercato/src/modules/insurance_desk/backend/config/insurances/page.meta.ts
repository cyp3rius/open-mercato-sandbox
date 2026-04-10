import React from 'react'

const shieldIcon = React.createElement(
  'svg',
  { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
  React.createElement('path', { d: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['insurance.config.manage'],
  pageTitle: 'Insurance',
  pageTitleKey: 'insurance_desk.config.insurances.settingsNav',
  pageGroup: 'Module Configs',
  pageGroupKey: 'settings.sections.moduleConfigs',
  pageOrder: 10,
  icon: shieldIcon,
  pageContext: 'settings' as const,
  breadcrumb: [
    { label: 'Insurance', labelKey: 'insurance_desk.config.insurances.settingsNav' },
  ],
} as const
