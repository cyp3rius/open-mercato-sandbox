import { rewriteProductCaseTemplatePlaybooks } from '../rewriteProductCaseTemplatePlaybooks'
import type { CatalogProductCaseTemplate } from '../../data/types'

function template(
  partial: Partial<CatalogProductCaseTemplate> & { id: string; title: string },
): CatalogProductCaseTemplate {
  return {
    playbookId: null,
    recurrenceEnabled: false,
    ...partial,
  }
}

describe('rewriteProductCaseTemplatePlaybooks', () => {
  const oldId = '11111111-1111-4111-8111-111111111111'
  const olderId = '22222222-2222-4222-8222-222222222222'
  const headId = '33333333-3333-4333-8333-333333333333'
  const unrelated = '44444444-4444-4444-8444-444444444444'

  it('returns unchanged when templates are empty or null', () => {
    expect(rewriteProductCaseTemplatePlaybooks(null, new Set([oldId]), headId)).toEqual({
      next: null,
      changed: false,
    })
    expect(rewriteProductCaseTemplatePlaybooks([], new Set([oldId]), headId)).toEqual({
      next: [],
      changed: false,
    })
  })

  it('rewrites matching historical playbook ids to the head', () => {
    const templates = [
      template({ id: 't1', title: 'Onboarding', playbookId: oldId }),
      template({ id: 't2', title: 'Review', playbookId: olderId }),
      template({ id: 't3', title: 'Other', playbookId: unrelated }),
    ]
    const result = rewriteProductCaseTemplatePlaybooks(
      templates,
      new Set([oldId, olderId, headId]),
      headId,
    )
    expect(result.changed).toBe(true)
    expect(result.next?.[0]?.playbookId).toBe(headId)
    expect(result.next?.[1]?.playbookId).toBe(headId)
    expect(result.next?.[2]?.playbookId).toBe(unrelated)
  })

  it('is idempotent when templates already point at the head', () => {
    const templates = [template({ id: 't1', title: 'Onboarding', playbookId: headId })]
    const result = rewriteProductCaseTemplatePlaybooks(
      templates,
      new Set([oldId, headId]),
      headId,
    )
    expect(result.changed).toBe(false)
    expect(result.next).toEqual(templates)
  })

  it('skips null playbookId entries', () => {
    const templates = [template({ id: 't1', title: 'No playbook', playbookId: null })]
    const result = rewriteProductCaseTemplatePlaybooks(
      templates,
      new Set([oldId]),
      headId,
    )
    expect(result.changed).toBe(false)
  })
})
