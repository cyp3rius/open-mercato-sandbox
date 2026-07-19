import type { Playbook } from '../data/entities'
import type { PlaybookUpdateInput } from '../data/validators'
import type { ProcedureBlock } from './procedureBlocks'
import type { ProcedureDuration } from './duration'

export type PlaybookContentSnapshot = {
  slug: string
  title: string
  body: string
  contextTags: string[]
  recommendedOwnerUserIds: string[]
  defaultSlaDuration: ProcedureDuration | null
  procedureDefinition: ProcedureBlock[]
  audience: string
  publishedAtIso: string | null
}

function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase()
}

function normalizeTags(tags: string[]): string[] {
  return [...tags].map((t) => String(t).trim()).filter(Boolean).sort((a, b) => a.localeCompare(b))
}

function publishedAtIso(value: Date | null | undefined): string | null {
  if (value == null) return null
  const d = value instanceof Date ? value : new Date(value)
  const t = d.getTime()
  return Number.isFinite(t) ? d.toISOString() : null
}

export function snapshotPlaybookContent(row: Playbook): PlaybookContentSnapshot {
  const tags = Array.isArray(row.contextTags) ? row.contextTags.map((x) => String(x)) : []
  const proc = Array.isArray(row.procedureDefinition) ? row.procedureDefinition : []
  return {
    slug: normalizeSlug(row.slug),
    title: row.title.trim(),
    body: row.body,
    contextTags: normalizeTags(tags),
    recommendedOwnerUserIds: Array.isArray(row.recommendedOwnerUserIds) ? [...row.recommendedOwnerUserIds] : [],
    defaultSlaDuration: row.defaultSlaDuration ?? null,
    procedureDefinition: proc as ProcedureBlock[],
    audience: row.audience,
    publishedAtIso: publishedAtIso(row.publishedAt ?? null),
  }
}

export function mergePlaybookUpdateIntoSnapshot(
  base: PlaybookContentSnapshot,
  parsed: PlaybookUpdateInput,
): PlaybookContentSnapshot {
  const next: PlaybookContentSnapshot = {
    ...base,
    contextTags: [...base.contextTags],
    procedureDefinition: JSON.parse(JSON.stringify(base.procedureDefinition)) as ProcedureBlock[],
  }
  if (parsed.slug !== undefined) next.slug = normalizeSlug(parsed.slug)
  if (parsed.title !== undefined) next.title = parsed.title.trim()
  if (parsed.body !== undefined) next.body = parsed.body
  if (parsed.contextTags !== undefined) next.contextTags = normalizeTags(parsed.contextTags.map((x) => String(x)))
  if (parsed.recommendedOwnerUserIds !== undefined) next.recommendedOwnerUserIds = [...parsed.recommendedOwnerUserIds]
  if (parsed.defaultSlaDuration !== undefined) next.defaultSlaDuration = parsed.defaultSlaDuration
  if (parsed.procedureDefinition !== undefined) {
    next.procedureDefinition = JSON.parse(JSON.stringify(parsed.procedureDefinition)) as ProcedureBlock[]
  }
  if (parsed.audience !== undefined) next.audience = parsed.audience
  if (parsed.publishedAt !== undefined) {
    next.publishedAtIso =
      parsed.publishedAt == null ? null : publishedAtIso(parsed.publishedAt instanceof Date ? parsed.publishedAt : new Date(parsed.publishedAt))
  }
  return next
}

export function playbookContentSnapshotsEqual(a: PlaybookContentSnapshot, b: PlaybookContentSnapshot): boolean {
  if (a.slug !== b.slug) return false
  if (a.title !== b.title) return false
  if (a.body !== b.body) return false
  if (a.audience !== b.audience) return false
  if (a.publishedAtIso !== b.publishedAtIso) return false
  if (a.contextTags.length !== b.contextTags.length) return false
  for (let i = 0; i < a.contextTags.length; i++) {
    if (a.contextTags[i] !== b.contextTags[i]) return false
  }
  if (JSON.stringify(a.recommendedOwnerUserIds) !== JSON.stringify(b.recommendedOwnerUserIds)) return false
  if (JSON.stringify(a.defaultSlaDuration) !== JSON.stringify(b.defaultSlaDuration)) return false
  return JSON.stringify(a.procedureDefinition) === JSON.stringify(b.procedureDefinition)
}
