export type DataTablePageItem = number | 'ellipsis'

const MAX_VISIBLE_WITHOUT_ELLIPSIS = 7

/**
 * Builds page number items for DataTable pagination (`1 … 4 5 6 … 20`).
 * When totalPages <= 7, returns every page with no ellipsis.
 */
export function buildPageItems(page: number, totalPages: number): DataTablePageItem[] {
  const safeTotal = Math.max(1, Math.floor(totalPages) || 1)
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), safeTotal)

  if (safeTotal <= MAX_VISIBLE_WITHOUT_ELLIPSIS) {
    return Array.from({ length: safeTotal }, (_, index) => index + 1)
  }

  const siblings = 1
  const left = Math.max(2, safePage - siblings)
  const right = Math.min(safeTotal - 1, safePage + siblings)

  const items: DataTablePageItem[] = [1]

  if (left > 2) {
    items.push('ellipsis')
  } else {
    for (let n = 2; n < left; n += 1) items.push(n)
  }

  for (let n = left; n <= right; n += 1) items.push(n)

  if (right < safeTotal - 1) {
    items.push('ellipsis')
  } else {
    for (let n = right + 1; n < safeTotal; n += 1) items.push(n)
  }

  items.push(safeTotal)
  return items
}
