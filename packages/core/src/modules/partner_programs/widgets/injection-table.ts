import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

export const injectionTable: ModuleInjectionTable = {
  'detail:customers.person:tabs': [
    {
      widgetId: 'partner_programs.injection.partner-incentives',
      kind: 'tab',
      groupId: 'partner-incentives',
      groupLabel: 'partner_programs.partnerTab.tabLabel',
      priority: 45,
    },
  ],
  'detail:customers.company:tabs': [
    {
      widgetId: 'partner_programs.injection.partner-incentives',
      kind: 'tab',
      groupId: 'partner-incentives',
      groupLabel: 'partner_programs.partnerTab.tabLabel',
      priority: 45,
    },
  ],
  'customers.person.detail:tabs': [
    {
      widgetId: 'partner_programs.injection.partner-incentives',
      kind: 'tab',
      groupId: 'partner-incentives',
      groupLabel: 'partner_programs.partnerTab.tabLabel',
      priority: 45,
    },
  ],
  'customers.company.detail:tabs': [
    {
      widgetId: 'partner_programs.injection.partner-incentives',
      kind: 'tab',
      groupId: 'partner-incentives',
      groupLabel: 'partner_programs.partnerTab.tabLabel',
      priority: 45,
    },
  ],
}

export default injectionTable
