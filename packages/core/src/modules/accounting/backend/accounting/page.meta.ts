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
  React.createElement('path', { d: 'M4 3h12l4 4v14H4z' }),
  React.createElement('path', { d: 'M8 13h8' }),
  React.createElement('path', { d: 'M8 17h8' }),
  React.createElement('path', { d: 'M14 3v5h5' }),
)

export const metadata = {
  requireAuth: true,
  requireFeatures: ['accounting.invoices.view'],
  pageTitle: 'Accounting',
  pageTitleKey: 'accounting.hub.title',
  pageGroup: 'Accounting',
  pageGroupKey: 'accounting.nav.group',
  pageOrder: 46,
  icon,
  breadcrumb: [{ label: 'Accounting', labelKey: 'accounting.hub.title' }],
}
