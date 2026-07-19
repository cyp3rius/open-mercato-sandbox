export function resolveInvokeProcedureOwner(input: {
  mayAssign: boolean
  requestedOwnerUserId?: string | null
  recommendedOwnerUserIds?: string[] | null
  parentOwnerUserId?: string | null
}): string | null {
  const requested = input.requestedOwnerUserId?.trim() || ''
  if (input.mayAssign && requested.length) return requested
  const recommended = Array.isArray(input.recommendedOwnerUserIds)
    ? input.recommendedOwnerUserIds.map((id) => id.trim()).find((id) => id.length > 0) || ''
    : ''
  if (recommended.length) return recommended
  const parent = input.parentOwnerUserId?.trim() || ''
  return parent.length ? parent : null
}
