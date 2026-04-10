export const metadata = {
  requireAuth: true,
  requireFeatures: ['insurance_desk.access', 'insurance.leads.manage'],
  pageTitleKey: 'insurance_desk.nav.createLead',
  pageTitle: 'Create inquiry',
  pageGroupKey: 'insurance_desk.nav.group',
  pageGroup: 'Insurance',
  navFlat: false,
  pageOrder: 4525,
  breadcrumb: [
    { label: 'Dashboard', labelKey: 'insurance_desk.hub.dashboardTitle', href: '/backend/insurance-desk' },
    { label: 'Inquiries', labelKey: 'insurance_desk.leads.title', href: '/backend/insurance-desk/leads' },
    { label: 'New inquiry', labelKey: 'insurance_desk.leads.create.breadcrumb' },
  ],
}
