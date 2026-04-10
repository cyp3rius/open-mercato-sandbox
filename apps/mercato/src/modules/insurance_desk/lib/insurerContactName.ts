export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim()
  if (!trimmed.length) return { firstName: '', lastName: '' }
  const space = trimmed.indexOf(' ')
  if (space === -1) return { firstName: trimmed, lastName: '' }
  return {
    firstName: trimmed.slice(0, space).trim(),
    lastName: trimmed.slice(space + 1).trim(),
  }
}

export function joinFullName(firstName: string, lastName: string): string {
  return [firstName, lastName]
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .join(' ')
    .trim()
}
