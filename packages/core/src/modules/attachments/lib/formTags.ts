import {
  normalizeAttachmentAssignments,
  normalizeAttachmentTags,
  type AttachmentAssignment,
} from './metadata'

export function parseFormTags(value: FormDataEntryValue | null): string[] {
  if (!value) return []
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    try {
      const parsed = JSON.parse(trimmed)
      return normalizeAttachmentTags(parsed)
    } catch {
      return normalizeAttachmentTags(value)
    }
  }
  return []
}

export function parseFormAssignments(value: FormDataEntryValue | null): AttachmentAssignment[] {
  if (!value) return []
  if (typeof value !== 'string') return []
  const trimmed = value.trim()
  if (!trimmed) return []
  try {
    const parsed = JSON.parse(trimmed)
    return normalizeAttachmentAssignments(parsed)
  } catch {
    return []
  }
}
