export const DRIVER_LIST_DEFAULT_PAGE_SIZE = 30
export const DRIVER_LIST_MAX_PAGE_SIZE = 50

export function parseDriverListPagination(url: URL): { page: number; pageSize: number } {
  const pageRaw = Number(url.searchParams.get('page') ?? '1')
  const pageSizeRaw = Number(
    url.searchParams.get('pageSize') ?? String(DRIVER_LIST_DEFAULT_PAGE_SIZE),
  )
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
      ? Math.min(DRIVER_LIST_MAX_PAGE_SIZE, Math.floor(pageSizeRaw))
      : DRIVER_LIST_DEFAULT_PAGE_SIZE
  return { page, pageSize }
}
