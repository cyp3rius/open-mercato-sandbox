export function resolveDriverPayoutPercent(params: {
  profilePayoutPercent: number | string | null | undefined
  defaultPayoutPercent: number | string | null | undefined
}): number {
  const profile = Number(params.profilePayoutPercent)
  if (Number.isFinite(profile) && profile > 0) {
    return profile
  }

  const fallback = Number(params.defaultPayoutPercent)
  if (Number.isFinite(fallback) && fallback >= 0) {
    return fallback
  }

  return 0
}
