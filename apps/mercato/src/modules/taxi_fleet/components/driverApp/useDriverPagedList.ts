'use client'

import * as React from 'react'

export const DRIVER_LIST_PAGE_SIZE = 30

export type DriverPagedResult<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
}

type UseDriverPagedListOptions<T> = {
  /** Stable key — cache resets when it changes (filters, tabs, …). */
  queryKey: string
  fetchPage: (page: number, pageSize: number) => Promise<DriverPagedResult<T>>
  pageSize?: number
  enabled?: boolean
}

/**
 * Server-backed pagination with a small in-memory page cache and adjacent-page prefetch.
 */
export function useDriverPagedList<T>({
  queryKey,
  fetchPage,
  pageSize = DRIVER_LIST_PAGE_SIZE,
  enabled = true,
}: UseDriverPagedListOptions<T>) {
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [cache, setCache] = React.useState<Map<number, T[]>>(() => new Map())
  const [loading, setLoading] = React.useState(Boolean(enabled))
  const [error, setError] = React.useState(false)

  const cacheRef = React.useRef(cache)
  cacheRef.current = cache
  const inflightRef = React.useRef(new Set<number>())
  const fetchPageRef = React.useRef(fetchPage)
  fetchPageRef.current = fetchPage
  const totalRef = React.useRef(total)
  totalRef.current = total

  React.useEffect(() => {
    setPage(1)
    setTotal(0)
    setCache(new Map())
    setError(false)
    inflightRef.current.clear()
    setLoading(Boolean(enabled))
  }, [queryKey, enabled, pageSize])

  const ensurePage = React.useCallback(
    async (targetPage: number, opts?: { silent?: boolean }) => {
      if (!enabled || targetPage < 1) return null
      if (cacheRef.current.has(targetPage)) return cacheRef.current.get(targetPage) ?? null
      if (inflightRef.current.has(targetPage)) return null

      inflightRef.current.add(targetPage)
      if (!opts?.silent) setLoading(true)
      try {
        const result = await fetchPageRef.current(targetPage, pageSize)
        setCache((prev) => {
          const next = new Map(prev)
          next.set(result.page, result.items)
          return next
        })
        setTotal(result.total)
        setError(false)
        return result.items
      } catch (err) {
        setError(true)
        throw err
      } finally {
        inflightRef.current.delete(targetPage)
        if (!opts?.silent) setLoading(false)
      }
    },
    [enabled, pageSize],
  )

  React.useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        await ensurePage(page)
        if (cancelled) return
        const pageCount = Math.max(1, Math.ceil(totalRef.current / pageSize) || 1)
        if (page < pageCount) {
          void ensurePage(page + 1, { silent: true }).catch(() => undefined)
        }
        if (page > 1) {
          void ensurePage(page - 1, { silent: true }).catch(() => undefined)
        }
      } catch {
        // surfaced via error flag; callers may flash
      }
    })()
    return () => {
      cancelled = true
    }
  }, [enabled, ensurePage, page, pageSize, queryKey])

  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1)
  const safePage = Math.min(Math.max(1, page), pageCount)
  const items = cache.get(safePage) ?? []

  React.useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  const goToPage = React.useCallback((nextPage: number) => {
    setPage(Math.max(1, nextPage))
  }, [])

  const reload = React.useCallback(async () => {
    setCache(new Map())
    inflightRef.current.clear()
    setLoading(true)
    try {
      await ensurePage(page)
      const pageCountNow = Math.max(1, Math.ceil(totalRef.current / pageSize) || 1)
      if (page < pageCountNow) {
        void ensurePage(page + 1, { silent: true }).catch(() => undefined)
      }
    } finally {
      setLoading(false)
    }
  }, [ensurePage, page, pageSize])

  return {
    items,
    page: safePage,
    pageSize,
    pageCount,
    total,
    loading,
    error,
    goToPage,
    reload,
    canGoPrev: safePage > 1,
    canGoNext: safePage < pageCount && total > 0,
  }
}
