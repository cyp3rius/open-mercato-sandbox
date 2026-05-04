"use client"

import { CrmKpiMetricWidgetClient } from '../shared/crmKpiMetric.client'
import type { DashboardWidgetComponentProps } from '@open-mercato/shared/modules/dashboard/widgets'
import type { CrmKpiSettings } from '../shared/config'

export default function OverdueResourceTasksWidget(props: DashboardWidgetComponentProps<CrmKpiSettings>) {
  return (
    <CrmKpiMetricWidgetClient
      {...props}
      metricKey="overdueResourceTasks"
      titleKey="dashboards.crm.overdueResourceTasks.title"
      titleFallback="Overdue resource tasks"
      linkHref="/backend/resources/resources"
      linkLabelKey="dashboards.crm.overdueResourceTasks.link"
      linkLabelFallback="Open resources"
    />
  )
}
