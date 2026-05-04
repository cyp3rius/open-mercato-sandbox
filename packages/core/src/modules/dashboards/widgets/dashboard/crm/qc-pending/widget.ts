import { lazyDashboardWidget, type DashboardWidgetModule } from '@open-mercato/shared/modules/dashboard/widgets'
import { DEFAULT_CRM_KPI_SETTINGS, hydrateCrmKpiSettings, type CrmKpiSettings } from '../shared/config'

const QcPendingWidget = lazyDashboardWidget(() => import('./widget.client'))

const widget: DashboardWidgetModule<CrmKpiSettings> = {
  metadata: {
    id: 'crm.qc_pending',
    title: 'QC pending',
    description: 'Workflow user tasks that are overdue and not completed.',
    features: ['dashboards.view', 'workflows.view_tasks'],
    defaultSize: 'sm',
    defaultEnabled: false,
    defaultSettings: DEFAULT_CRM_KPI_SETTINGS,
    tags: ['crm', 'kpi', 'workflows'],
    category: 'crm',
    icon: 'clipboard-check',
    supportsRefresh: true,
  },
  Widget: QcPendingWidget,
  hydrateSettings: hydrateCrmKpiSettings,
  dehydrateSettings: () => ({}),
}

export default widget
