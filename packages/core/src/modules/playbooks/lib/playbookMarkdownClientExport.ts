'use client'

import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

export type PlaybookMarkdownExportItem = {
  id?: string
  slug?: string
  title?: string
  version?: number
  markdown: string
}

export type ExportPlaybooksMarkdownResult =
  | { ok: true; count: number }
  | { ok: false; reason: 'none' | 'empty' | 'error' }

function downloadTextFile(filename: string, contents: string, mimeType: string) {
  const blob = new Blob([contents], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function safeFilenameSlug(slug: string): string {
  const cleaned = slug.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-')
  return cleaned.length > 0 ? cleaned : 'playbook'
}

function downloadExportedItems(items: PlaybookMarkdownExportItem[]) {
  if (items.length === 1) {
    const only = items[0]!
    downloadTextFile(
      `${safeFilenameSlug(typeof only.slug === 'string' ? only.slug : 'playbook')}.md`,
      only.markdown,
      'text/markdown;charset=utf-8',
    )
    return
  }
  const stamp = new Date().toISOString().slice(0, 10)
  downloadTextFile(
    `playbooks-export-${stamp}.json`,
    JSON.stringify({ ok: true, items }, null, 2),
    'application/json;charset=utf-8',
  )
}

/** Download procedure Markdown for one or more playbook ids (active or archived). */
export async function exportPlaybooksMarkdownByIds(ids: string[]): Promise<ExportPlaybooksMarkdownResult> {
  const uniqueIds = Array.from(new Set(ids.filter((id) => typeof id === 'string' && id.length > 0)))
  if (uniqueIds.length === 0) return { ok: false, reason: 'none' }

  const call = await apiCall<{ ok?: boolean; items?: PlaybookMarkdownExportItem[] }>('/api/playbooks/to-markdown', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ids: uniqueIds }),
  })

  if (!call.ok || !call.result) return { ok: false, reason: 'error' }

  const items = Array.isArray(call.result.items) ? call.result.items : []
  const withMarkdown = items.filter(
    (item): item is PlaybookMarkdownExportItem =>
      item != null && typeof item === 'object' && typeof item.markdown === 'string' && item.markdown.length > 0,
  )

  if (withMarkdown.length === 0) return { ok: false, reason: 'empty' }

  downloadExportedItems(withMarkdown)
  return { ok: true, count: withMarkdown.length }
}
