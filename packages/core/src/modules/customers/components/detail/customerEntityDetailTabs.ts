import * as React from 'react'
import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Handshake,
  Layers,
  LayoutList,
  MapPin,
  ShoppingBag,
  StickyNote,
  User,
  Users,
} from 'lucide-react'

export const CUSTOMER_DETAIL_TAB_DETAILS = 'details' as const

export const CUSTOMER_DETAIL_RELATED_TABS = [
  'people',
  'addresses',
  'resources',
  'tasks',
  'notes',
  'activities',
  'deals',
  'quotes',
  'orders',
  'cases',
  'policies',
] as const

export type CustomerDetailRelatedTab = (typeof CUSTOMER_DETAIL_RELATED_TABS)[number]
export type CustomerDetailCanonicalTab = typeof CUSTOMER_DETAIL_TAB_DETAILS | CustomerDetailRelatedTab

const RELATED_TAB_SET = new Set<string>(CUSTOMER_DETAIL_RELATED_TABS)

const TAB_ICON_CLASS = 'size-3.5 shrink-0'

function tabIcon(Icon: LucideIcon): ReactNode {
  return React.createElement(Icon, { className: TAB_ICON_CLASS, 'aria-hidden': true })
}

const INJECTED_TAB_ICONS: Record<string, ReactNode> = {
  'partner-incentives': tabIcon(Handshake),
}

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

export type CustomerDetailTabDefinition = {
  id: string
  label: ReactNode
  icon?: ReactNode
}

export function buildCustomerDetailTabDefinitions(args: {
  kind: CustomerEntityKind
  t: (key: string, fallback?: string) => string
  i18nPrefix: string
  injectedTabs?: Array<{ id: string; label: ReactNode; icon?: ReactNode }>
}): CustomerDetailTabDefinition[] {
  const { kind, t, i18nPrefix, injectedTabs = [] } = args
  const tabs: CustomerDetailTabDefinition[] = [
    {
      id: CUSTOMER_DETAIL_TAB_DETAILS,
      label: t(`${i18nPrefix}.tabs.details`, 'Details'),
      icon: tabIcon(kind === 'company' ? Building2 : User),
    },
    ...(kind === 'company'
      ? [
          {
            id: 'people',
            label: t(`${i18nPrefix}.tabs.people`, 'People'),
            icon: tabIcon(Users),
          },
        ]
      : []),
    {
      id: 'addresses',
      label: t(`${i18nPrefix}.tabs.addresses`, 'Addresses'),
      icon: tabIcon(MapPin),
    },
    {
      id: 'resources',
      label: t(`${i18nPrefix}.tabs.resources`, 'Resources'),
      icon: tabIcon(Layers),
    },
    {
      id: 'tasks',
      label: t(`${i18nPrefix}.tabs.tasks`, 'Tasks'),
      icon: tabIcon(ClipboardCheck),
    },
    {
      id: 'notes',
      label: t(`${i18nPrefix}.tabs.notes`, 'Notes'),
      icon: tabIcon(StickyNote),
    },
    {
      id: 'activities',
      label: t(`${i18nPrefix}.tabs.activities`, 'Activities'),
      icon: tabIcon(Activity),
    },
    {
      id: 'deals',
      label: t(`${i18nPrefix}.tabs.deals`, 'Deals'),
      icon: tabIcon(ShoppingBag),
    },
    {
      id: 'quotes',
      label: t(`${i18nPrefix}.tabs.quotes`, 'Quotes'),
      icon: tabIcon(FileText),
    },
    {
      id: 'orders',
      label: t(`${i18nPrefix}.tabs.orders`, 'Orders'),
      icon: tabIcon(CircleDollarSign),
    },
    {
      id: 'cases',
      label: t(`${i18nPrefix}.tabs.cases`, 'Cases'),
      icon: tabIcon(LayoutList),
    },
    {
      id: 'policies',
      label: t(`${i18nPrefix}.tabs.policies`, 'Policies'),
      icon: tabIcon(FileText),
    },
    ...injectedTabs.map((tab) => ({
      id: tab.id,
      label: tab.label,
      icon: tab.icon ?? INJECTED_TAB_ICONS[tab.id],
    })),
  ]
  return tabs
}
