"use client"

import { CrmKpiMetricWidgetClient } from '../shared/crmKpiMetric.client'
import type { DashboardWidgetComponentProps } from '@open-mercato/shared/modules/dashboard/widgets'
import type { CrmKpiSettings } from '../shared/config'

export default function QcPendingWidget(props: DashboardWidgetComponentProps<CrmKpiSettings>) {
  return (
    <CrmKpiMetricWidgetClient
      {...props}
      metricKey="qcPending"
      titleKey="dashboards.crm.qcPending.title"
      titleFallback="QC / overdue tasks"
      linkHref="/backend/tasks?overdue=true"
      linkLabelKey="dashboards.crm.qcPending.link"
      linkLabelFallback="Open tasks"
    />
  )
}
