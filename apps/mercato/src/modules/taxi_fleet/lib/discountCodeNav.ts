import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import type { TripDiscountSnapshot } from './tripDiscount'

const DISCOUNT_CODES_BASE = '/backend/taxi-fleet/discount-codes'

type DiscountCodeListItem = {
  id: string
  code: string
}

type DiscountCodeListResponse = {
  items?: DiscountCodeListItem[]
}

function detailHref(id: string): string {
  return `${DISCOUNT_CODES_BASE}/${encodeURIComponent(id)}`
}

/** Resolve CRM detail URL for an applied trip discount (id preferred; else search by code). */
export async function resolveDiscountCodeDetailHref(
  snapshot: TripDiscountSnapshot,
): Promise<string | null> {
  const id = snapshot.id?.trim()
  if (id) return detailHref(id)

  const code = snapshot.code.trim()
  if (!code) return null

  const params = new URLSearchParams({
    search: code,
    pageSize: '50',
    page: '1',
  })
  const call = await apiCall<DiscountCodeListResponse>(`/api/taxi_fleet/discount-codes?${params}`)
  if (!call.ok || !Array.isArray(call.result?.items)) return null

  const normalized = code.toUpperCase()
  const match = call.result.items.find((item) => item.code?.trim().toUpperCase() === normalized)
  return match?.id ? detailHref(match.id) : null
}
