import { lazyDashboardWidget, type DashboardWidgetModule } from '@open-mercato/shared/modules/dashboard/widgets'
import { DEFAULT_CRM_KPI_SETTINGS, hydrateCrmKpiSettings, type CrmKpiSettings } from '../shared/config'

const OpenCasesSlaWidget = lazyDashboardWidget(() => import('./widget.client'))

const widget: DashboardWidgetModule<CrmKpiSettings> = {
  metadata: {
    id: 'crm.open_cases_sla',
    title: 'Open cases (SLA)',
    description: 'Cases still open after 48 hours.',
    features: ['dashboards.view', 'cases.view'],
    defaultSize: 'sm',
    defaultEnabled: false,
    defaultSettings: DEFAULT_CRM_KPI_SETTINGS,
    tags: ['crm', 'kpi', 'cases'],
    category: 'crm',
    icon: 'clock',
    supportsRefresh: true,
  },
  Widget: OpenCasesSlaWidget,
  hydrateSettings: hydrateCrmKpiSettings,
  dehydrateSettings: () => ({}),
}

export default widget
