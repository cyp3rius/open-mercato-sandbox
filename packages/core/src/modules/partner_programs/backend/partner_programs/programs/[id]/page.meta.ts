export const metadata = {
  requireAuth: true,
  requireFeatures: ['partner_programs.view'],
  pageTitle: 'Partner program',
  pageTitleKey: 'partner_programs.form.editTitle',
  pageGroup: 'Partner programs',
  pageGroupKey: 'partner_programs.nav.group',
  navHidden: true,
  breadcrumb: [
    { label: 'Partner programs', labelKey: 'partner_programs.list.title', href: '/backend/partner_programs/programs' },
    { label: 'Details', labelKey: 'partner_programs.form.editTitle' },
  ],
}
