export type CrmKpiMetricKey = 'overdueResourceTasks' | 'openCasesSla' | 'qcPending'

export type CrmKpiSettings = Record<string, never>

export const DEFAULT_CRM_KPI_SETTINGS: CrmKpiSettings = {}

export function hydrateCrmKpiSettings(raw: unknown): CrmKpiSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CRM_KPI_SETTINGS }
  return { ...DEFAULT_CRM_KPI_SETTINGS }
}
