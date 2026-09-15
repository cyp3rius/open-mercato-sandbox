import type { CatalogProductCaseTemplate } from '../data/types'

export type RewriteProductCaseTemplatePlaybooksResult = {
  next: CatalogProductCaseTemplate[] | null
  changed: boolean
}

/**
 * Replace case-template playbookIds that match any historical version id
 * with the latest head playbookId.
 */
export function rewriteProductCaseTemplatePlaybooks(
  caseTemplates: CatalogProductCaseTemplate[] | null | undefined,
  fromPlaybookIds: ReadonlySet<string>,
  toPlaybookId: string,
): RewriteProductCaseTemplatePlaybooksResult {
  const target = typeof toPlaybookId === 'string' ? toPlaybookId.trim() : ''
  if (!target.length || !fromPlaybookIds.size) {
    return {
      next: Array.isArray(caseTemplates) ? caseTemplates : null,
      changed: false,
    }
  }
  if (!Array.isArray(caseTemplates) || caseTemplates.length === 0) {
    return { next: Array.isArray(caseTemplates) ? caseTemplates : null, changed: false }
  }

  let changed = false
  const next = caseTemplates.map((template) => {
    const current =
      typeof template.playbookId === 'string' ? template.playbookId.trim() : ''
    if (!current.length || current === target) return template
    if (!fromPlaybookIds.has(current)) return template
    changed = true
    return { ...template, playbookId: target }
  })

  return { next, changed }
}
