import type { AdminNavItem } from './nav'
import type { ReactNode } from 'react'

export const DAILY_WORK_GROUP_ID = 'mercato.nav.dailyWork'

/** Hub links duplicated for quick access; order is preserved. Missing routes (RBAC) are omitted. */
export const DAILY_WORK_HREFS_ORDERED: readonly string[] = [
  '/backend',
  '/backend/cases',
  '/backend/playbooks',
  '/backend/partner_programs/programs',
  '/backend/procurement',
  '/backend/procurement/processes',
  '/backend/customers/companies',
  '/backend/customers/people',
  '/backend/sales/orders',
  '/backend/messages',
  '/backend/resources/resources',
  '/backend/accounting/invoices',
  '/backend/insurance-desk',
  '/backend/insurance-desk/leads',
]

export type SidebarNavItem = {
  id?: string
  href: string
  title: string
  defaultTitle: string
  enabled: boolean
  hidden?: boolean
  icon?: ReactNode
  pageContext?: 'main' | 'admin' | 'settings' | 'profile'
  /** Label-only block with nested links (no top-level row link). */
  variant?: 'section'
  /** When set with non-section parents, nested links stay visible whenever the group is open. */
  sidebarNestAlwaysVisible?: boolean
  children?: SidebarNavItem[]
}

export function normalizeSidebarHref(href: string): string {
  const t = href.trim()
  if (t === '') return ''
  if (!t || t === '/') return '/backend'
  return t.endsWith('/') && t.length > 1 ? t.slice(0, -1) : t
}

/** Depth-first flatten of admin nav items (same shape as settings sections helper). */
export function flattenAdminNavItemsForDailyWork(nodes: AdminNavItem[]): AdminNavItem[] {
  const out: AdminNavItem[] = []
  const walk = (xs: AdminNavItem[]) => {
    for (const x of xs) {
      out.push(x)
      if (x.children?.length) walk(x.children)
    }
  }
  walk(nodes)
  return out
}

export function buildDailyWorkSidebarGroup(
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
  for (const href of DAILY_WORK_HREFS_ORDERED) {
    const key = normalizeSidebarHref(href)
    if (key === '/backend') {
      items.push({
        href: '/backend',
        title: translate('backend.nav.dailyWorkHome', 'Dashboard'),
        defaultTitle: 'Dashboard',
        enabled: true,
        pageContext: 'main',
      })
      continue
    }
    const found = byNorm.get(key)
    if (found) items.push(mapItem(found))
  }

  return {
    id: DAILY_WORK_GROUP_ID,
    name: translate('backend.nav.dailyWork', 'Daily work'),
    defaultName: 'Daily work',
    weight: Number.MIN_SAFE_INTEGER,
    items,
  }
}

/** Prefer longest matching nav href; `/backend` matches only the dashboard path exactly. */
export function findBestSidebarNavMatch<T extends { href: string }>(path: string, candidates: T[]): T | undefined {
  const pathNorm = path.split('?')[0].replace(/\/$/, '') || '/'
  const matches = candidates.filter((item) => {
    const raw = item.href.trim()
    if (!raw) return false
    const h = item.href.replace(/\/$/, '') || '/'
    if (h === '/backend') return pathNorm === '/backend'
    return pathNorm === h || pathNorm.startsWith(`${h}/`)
  })
  if (matches.length === 0) return undefined
  return matches.reduce((a, b) => (a.href.length >= b.href.length ? a : b))
}
