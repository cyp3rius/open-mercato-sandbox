import type { ReactNode } from 'react'

export const CUSTOMER_DETAIL_TAB_DETAILS = 'details' as const

export const CUSTOMER_DETAIL_RELATED_TABS = [
  'notes',
  'activities',
  'deals',
  'quotes',
  'orders',
  'addresses',
  'tasks',
  'resources',
  'people',
  'cases',
  'policies',
] as const

export type CustomerDetailRelatedTab = (typeof CUSTOMER_DETAIL_RELATED_TABS)[number]
export type CustomerDetailCanonicalTab = typeof CUSTOMER_DETAIL_TAB_DETAILS | CustomerDetailRelatedTab

const RELATED_TAB_SET = new Set<string>(CUSTOMER_DETAIL_RELATED_TABS)

/** Resolve `?tab=` to a canonical tab id. Missing/unknown → details. */
export function resolveCustomerDetailTab(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return CUSTOMER_DETAIL_TAB_DETAILS
  const tab = raw.trim()
  if (tab === CUSTOMER_DETAIL_TAB_DETAILS) return CUSTOMER_DETAIL_TAB_DETAILS
  if (RELATED_TAB_SET.has(tab)) return tab
  // Injected widget ids and unknown aliases pass through (UMES).
  return tab
}

export type CustomerEntityKind = 'person' | 'company'

export function buildCustomerDetailTabDefinitions(args: {
  kind: CustomerEntityKind
  t: (key: string, fallback?: string) => string
  i18nPrefix: string
  injectedTabs?: Array<{ id: string; label: ReactNode }>
}): Array<{ id: string; label: ReactNode }> {
  const { kind, t, i18nPrefix, injectedTabs = [] } = args
  const tabs: Array<{ id: string; label: ReactNode }> = [
    { id: CUSTOMER_DETAIL_TAB_DETAILS, label: t(`${i18nPrefix}.tabs.details`, 'Details') },
    { id: 'notes', label: t(`${i18nPrefix}.tabs.notes`, 'Notes') },
    { id: 'activities', label: t(`${i18nPrefix}.tabs.activities`, 'Activities') },
    { id: 'deals', label: t(`${i18nPrefix}.tabs.deals`, 'Deals') },
    { id: 'quotes', label: t(`${i18nPrefix}.tabs.quotes`, 'Quotes') },
    { id: 'orders', label: t(`${i18nPrefix}.tabs.orders`, 'Orders') },
    ...(kind === 'company'
      ? [{ id: 'people', label: t(`${i18nPrefix}.tabs.people`, 'People') }]
      : []),
    { id: 'addresses', label: t(`${i18nPrefix}.tabs.addresses`, 'Addresses') },
    { id: 'tasks', label: t(`${i18nPrefix}.tabs.tasks`, 'Tasks') },
    { id: 'resources', label: t(`${i18nPrefix}.tabs.resources`, 'Resources') },
    { id: 'cases', label: t(`${i18nPrefix}.tabs.cases`, 'Cases') },
    { id: 'policies', label: t(`${i18nPrefix}.tabs.policies`, 'Policies') },
    ...injectedTabs.map((tab) => ({ id: tab.id, label: tab.label })),
  ]
  return tabs
}
