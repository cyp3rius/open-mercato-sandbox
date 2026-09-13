'use client'

import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'

export async function startDriverAppImpersonation(params: {
  teamMemberId: string
  errorMessage: string
}): Promise<boolean> {
  const call = await apiCall<{ ok?: boolean }>('/api/taxi_fleet/driver/impersonation', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ teamMemberId: params.teamMemberId }),
  })
  if (!call.ok) {
    flash(params.errorMessage, 'error')
    return false
  }
  window.location.assign('/driver')
  return true
}
