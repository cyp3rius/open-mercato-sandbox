export const metadata = {
  requireAuth: true,
  requireFeatures: ['insurance.leads.manage'],
  navHidden: true,
  pageTitleKey: 'insurance_desk.leads.detail.pageTitle',
  pageTitle: 'Inquiry details',
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'insurance_desk.hub.dashboardTitle', href: '/backend/insurance-desk' },
    { label: 'Inquiries', labelKey: 'insurance_desk.leads.title', href: '/backend/insurance-desk/leads' },
    { label: 'Details', labelKey: 'insurance_desk.leads.detail.breadcrumb' },
  ],
}
