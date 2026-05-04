import { lazyDashboardWidget, type DashboardWidgetModule } from '@open-mercato/shared/modules/dashboard/widgets'
import { DEFAULT_CRM_KPI_SETTINGS, hydrateCrmKpiSettings, type CrmKpiSettings } from '../shared/config'

const OverdueResourceTasksWidget = lazyDashboardWidget(() => import('./widget.client'))

const widget: DashboardWidgetModule<CrmKpiSettings> = {
  metadata: {
    id: 'crm.overdue_resource_tasks',
    title: 'Overdue resource tasks',
    description: 'Operations tasks on resources that are past due.',
    features: ['dashboards.view', 'resources.view'],
    defaultSize: 'sm',
    defaultEnabled: false,
    defaultSettings: DEFAULT_CRM_KPI_SETTINGS,
    tags: ['crm', 'kpi', 'resources'],
    category: 'crm',
    icon: 'alert-circle',
    supportsRefresh: true,
  },
  Widget: OverdueResourceTasksWidget,
  hydrateSettings: hydrateCrmKpiSettings,
  dehydrateSettings: () => ({}),
}

export default widget
