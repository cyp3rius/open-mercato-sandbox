export const metadata = {
  requireAuth: true,
  requireFeatures: ['insurance.insurers.manage'],
  pageTitleKey: 'insurance_desk.nav.createInsurer',
  pageTitle: 'Create insurer',
  pageGroupKey: 'insurance_desk.nav.group',
  pageGroup: 'Insurance',
  navFlat: false,
  pageOrder: 4535,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'insurance_desk.hub.dashboardTitle', href: '/backend/insurance-desk' },
    { label: 'Insurers', labelKey: 'insurance_desk.insurers.title', href: '/backend/insurance-desk/insurers' },
    { label: 'New', labelKey: 'insurance_desk.insurers.create.breadcrumb' },
  ],
}
