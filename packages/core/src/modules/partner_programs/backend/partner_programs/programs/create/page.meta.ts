export const metadata = {
  requireAuth: true,
  requireFeatures: ['partner_programs.create'],
  pageTitle: 'Create partner program',
  pageTitleKey: 'partner_programs.form.createTitle',
  pageGroup: 'Partner programs',
  pageGroupKey: 'partner_programs.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Partner programs', labelKey: 'partner_programs.list.title', href: '/backend/partner_programs/programs' },
    { label: 'Create', labelKey: 'partner_programs.form.createTitle' },
  ],
}
