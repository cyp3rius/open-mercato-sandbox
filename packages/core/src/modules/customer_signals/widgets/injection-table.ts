import type { ModuleInjectionTable } from '@open-mercato/shared/modules/widgets/injection'

export const injectionTable: ModuleInjectionTable = {
  'crud-form:customers:customer_person_profile:fields': [
    {
      widgetId: 'customer_signals.injection.customer-signals',
      kind: 'group',
      column: 2,
      groupLabel: 'customer_signals.widgets.panelTitle',
      priority: 190,
    },
  ],
  'crud-form:customers:customer_company_profile:fields': [
    {
      widgetId: 'customer_signals.injection.customer-signals',
      kind: 'group',
      column: 2,
      groupLabel: 'customer_signals.widgets.panelTitle',
      priority: 190,
    },
  ],
}

export default injectionTable
