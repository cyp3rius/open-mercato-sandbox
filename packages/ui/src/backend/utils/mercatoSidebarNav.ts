import type { AdminNavItem } from './nav'
import {
  DAILY_WORK_GROUP_ID,
  flattenAdminNavItemsForDailyWork,
  normalizeSidebarHref,
  type SidebarNavItem,
} from './dailyWorkNav'

export const MERCATO_SHORTCUTS_GROUP_ID = 'mercato.nav.shortcuts'

/** Hrefs surfaced in Mercato shortcuts + structured daily work (dedupe from remaining groups). */
export const MERCATO_SIDEBAR_DEDUPE_HREFS: readonly string[] = [
  '/backend',
  '/backend/messages',
  '/backend/tasks',
  '/backend/customers/companies',
  '/backend/customers/people',
  '/backend/customers/deals',
  '/backend/resources/resources',
  '/backend/resources/resource-types',
  '/backend/partner_programs/programs',
  '/backend/procurement',
  '/backend/cases',
  '/backend/playbooks',
  '/backend/insurance-desk/leads',
  '/backend/insurance-desk/policies',
  '/backend/insurance-desk/insurers',
  '/backend/accounting',
]

export function buildMercatoShortcutsSidebarGroup(
  entries: AdminNavItem[],
  translate: (key: string | undefined, fallback: string) => string,
  mapItem: (item: AdminNavItem) => SidebarNavItem,
): {
  id: string
  name: string
  defaultName: string
  weight: number
  items: SidebarNavItem[]
} {
  const flat = flattenAdminNavItemsForDailyWork(entries)
  const byNorm = new Map<string, AdminNavItem>()
  for (const e of flat) {
    const key = normalizeSidebarHref(e.href)
    if (!byNorm.has(key)) byNorm.set(key, e)
  }

  const items: SidebarNavItem[] = []
  for (const href of ['/backend/messages', '/backend/tasks'] as const) {
    const found = byNorm.get(normalizeSidebarHref(href))
    if (found) items.push(mapItem(found))
  }

  return {
    id: MERCATO_SHORTCUTS_GROUP_ID,
    name: translate('backend.nav.shortcuts', 'My shortcuts'),
    defaultName: 'My shortcuts',
    weight: Number.MIN_SAFE_INTEGER,
    items,
  }
}

export function buildMercatoDailyWorkStructuredGroup(
  entries: AdminNavItem[],
  translate: (key: string | undefined, fallback: string) => string,
  mapItem: (item: AdminNavItem) => SidebarNavItem,
): {
  id: string
  name: string
  defaultName: string
  weight: number
  items: SidebarNavItem[]
} {
  const flat = flattenAdminNavItemsForDailyWork(entries)
  const byNorm = new Map<string, AdminNavItem>()
  for (const e of flat) {
    const key = normalizeSidebarHref(e.href)
    if (!byNorm.has(key)) byNorm.set(key, e)
  }

  const pick = (href: string): SidebarNavItem | null => {
    const found = byNorm.get(normalizeSidebarHref(href))
    return found ? mapItem(found) : null
  }

  const dash: SidebarNavItem = {
    href: '/backend',
    title: translate('backend.nav.dailyWorkHome', 'Dashboard'),
    defaultTitle: 'Dashboard',
    enabled: true,
    pageContext: 'main',
  }

  const clientsChildren = (
    [
      '/backend/customers/companies',
      '/backend/customers/people',
      '/backend/customers/deals',
      '/backend/partner_programs/programs',
    ] as const
  )
    .map(pick)
    .filter((x): x is SidebarNavItem => x !== null)

  const resourcesChildren = (
    ['/backend/resources/resources', '/backend/resources/resource-types'] as const
  )
    .map(pick)
    .filter((x): x is SidebarNavItem => x !== null)

  const supportChildren = (
    ['/backend/procurement', '/backend/cases', '/backend/playbooks'] as const
  )
    .map(pick)
    .filter((x): x is SidebarNavItem => x !== null)

  const insuranceChildren = (
    [
      '/backend/insurance-desk/leads',
      '/backend/insurance-desk/policies',
      '/backend/insurance-desk/insurers',
    ] as const
  )
    .map(pick)
    .filter((x): x is SidebarNavItem => x !== null)

  const accounting = pick('/backend/accounting')

  const items: SidebarNavItem[] = [dash]

  if (clientsChildren.length) {
    items.push({
      id: 'mercato-section-clients',
      variant: 'section',
      href: '',
      title: translate('backend.nav.section.clients', 'Clients'),
      defaultTitle: 'Clients',
      enabled: true,
      pageContext: 'main',
      children: clientsChildren,
    })
  }

  if (resourcesChildren.length) {
    items.push({
      id: 'mercato-section-resources',
      variant: 'section',
      href: '',
      title: translate('backend.nav.section.resources', 'Resources'),
      defaultTitle: 'Resources',
      enabled: true,
      pageContext: 'main',
      children: resourcesChildren,
    })
  }

  if (supportChildren.length) {
    items.push({
      id: 'mercato-section-support',
      variant: 'section',
      href: '',
      title: translate('backend.nav.section.support', 'Service'),
      defaultTitle: 'Service',
      enabled: true,
      pageContext: 'main',
      children: supportChildren,
    })
  }

  if (insuranceChildren.length) {
    items.push({
      id: 'mercato-section-insurance',
      variant: 'section',
      href: '',
      title: translate('backend.nav.section.insurance', 'Insurance'),
      defaultTitle: 'Insurance',
      enabled: true,
      pageContext: 'main',
      children: insuranceChildren,
    })
  }

  if (accounting) items.push(accounting)

  return {
    id: DAILY_WORK_GROUP_ID,
    name: translate('backend.nav.dailyWork', 'Daily work'),
    defaultName: 'Daily work',
    weight: Number.MIN_SAFE_INTEGER + 1,
    items,
  }
}

export type NavGroupLike<T extends { href: string; children?: T[] }> = {
  id?: string
  name: string
  defaultName?: string
  items: T[]
  weight: number
}

export function filterNavGroupsRemoveDedupeHrefs<T extends { href: string; children?: T[] }>(
  groups: NavGroupLike<T>[],
  dedupe: ReadonlySet<string>,
): NavGroupLike<T>[] {
  const filterItems = (items: T[]): T[] =>
    items
      .map((item) => {
        const nextChildren = item.children?.length ? filterItems(item.children) : undefined
        const hrefNorm = normalizeSidebarHref(item.href)
        if (dedupe.has(hrefNorm)) return null
        const hasKids = nextChildren !== undefined && nextChildren.length > 0
        const hadKids = Boolean(item.children?.length)
        if (hadKids && !hasKids) return null
        return { ...item, ...(hasKids ? { children: nextChildren } : { children: undefined }) } as T
      })
      .filter((x): x is T => x !== null)

  return groups
    .map((group) => ({
      ...group,
      items: filterItems(group.items),
    }))
    .filter((g) => g.items.length > 0)
}
