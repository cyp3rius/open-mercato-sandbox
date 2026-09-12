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

/** Resolve procedure owner for start / assign-when-missing (`cases.edit`). */
export function resolveStartOrAssignProcedureOwner(input: {
  mayEdit: boolean
  requestedOwnerUserId?: string | null
  caseOwnerUserId?: string | null
}): string | null {
  const requested = input.requestedOwnerUserId?.trim() || ''
  if (input.mayEdit && requested.length) return requested
  const caseOwner = input.caseOwnerUserId?.trim() || ''
  return caseOwner.length ? caseOwner : null
}
