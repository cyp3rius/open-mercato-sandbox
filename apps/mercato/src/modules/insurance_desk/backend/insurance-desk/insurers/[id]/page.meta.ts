export const metadata = {
  requireAuth: true,
  requireFeatures: ['insurance.insurers.manage'],
  navHidden: true,
  pageTitleKey: 'insurance_desk.insurers.detail.pageTitle',
  pageTitle: 'Insurer details',
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'insurance_desk.hub.dashboardTitle', href: '/backend/insurance-desk' },
    { label: 'Insurers', labelKey: 'insurance_desk.insurers.title', href: '/backend/insurance-desk/insurers' },
    { label: 'Details', labelKey: 'insurance_desk.insurers.detail.breadcrumb' },
  ],
}
