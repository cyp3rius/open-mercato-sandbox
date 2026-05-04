export function parsePlaybookBooleanField(...sources: unknown[]): boolean | undefined {
  for (const v of sources) {
    if (v === true || v === false) return v
    if (v === 'true') return true
    if (v === 'false') return false
    if (typeof v === 'number' && Number.isFinite(v)) {
      if (v === 1) return true
      if (v === 0) return false
    }
  }
  return undefined
}
