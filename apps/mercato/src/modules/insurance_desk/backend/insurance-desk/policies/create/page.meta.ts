export const metadata = {
  requireAuth: true,
  requireFeatures: ['insurance.policies.manage'],
  pageTitleKey: 'insurance_desk.nav.createPolicy',
  pageTitle: 'Create policy',
  pageGroupKey: 'insurance_desk.nav.group',
  pageGroup: 'Insurance',
  navFlat: false,
  pageOrder: 4515,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'insurance_desk.hub.dashboardTitle', href: '/backend/insurance-desk' },
    { label: 'Policies', labelKey: 'insurance_desk.policies.title', href: '/backend/insurance-desk/policies' },
    { label: 'New policy', labelKey: 'insurance_desk.policies.form.breadcrumb' },
  ],
}
