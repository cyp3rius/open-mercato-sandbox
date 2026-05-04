"use client"

import { CrmKpiMetricWidgetClient } from '../shared/crmKpiMetric.client'
import type { DashboardWidgetComponentProps } from '@open-mercato/shared/modules/dashboard/widgets'
import type { CrmKpiSettings } from '../shared/config'

export default function OpenCasesSlaWidget(props: DashboardWidgetComponentProps<CrmKpiSettings>) {
  return (
    <CrmKpiMetricWidgetClient
      {...props}
      metricKey="openCasesSla"
      titleKey="dashboards.crm.openCasesSla.title"
      titleFallback="Open cases past SLA"
      linkHref="/backend/cases"
      linkLabelKey="dashboards.crm.openCasesSla.link"
      linkLabelFallback="Open cases"
    />
  )
}
