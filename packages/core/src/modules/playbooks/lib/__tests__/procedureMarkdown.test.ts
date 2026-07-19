import {
  compileProcedureDocument,
  compileProcedureSteps,
  parseProcedureMarkdown,
  procedureStepUuid,
  uuidV5FromName,
} from '../procedureMarkdown'
import { exportProcedureDocument } from '../procedureMarkdownExport'
import { newProcedureBlockId, type ProcedureBlock } from '../procedureBlocks'

const SAMPLE = `---
slug: damage-intake
title: Przyjęcie szkody
audience: internal
contextTags:
  - damage
  - collision
defaultSlaDuration:
  amount: 3
  unit: days
---

# Opis

Proza dla operatora.

## Procedure

- id: start
  kind: start

- id: call-customer
  kind: action
  label: Zadzwoń do klienta
  actionVariant: notify
  actionCode: notify
  notifyChannel: email
  notifyTarget: customer
  notifyBody: |
    Dzień dobry, rozpoczęliśmy sprawę.

- id: need-specialist
  kind: condition
  label: Potrzebny specjalista?
  conditionMode: manual
  yes:
    - id: invoke-specialist
      kind: invoke_procedure
      playbookSlugs:
        - specialist-review
      slaDuration:
        amount: 2
        unit: days
  no:
    - id: back-to-call
      kind: goto
      target: call-customer

- id: end
  kind: end
`

describe('procedureMarkdown', () => {
  it('produces stable UUID v5 for the same slug and step id', () => {
    const a = procedureStepUuid('damage-intake', 'call-customer')
    const b = procedureStepUuid('damage-intake', 'call-customer')
    const c = procedureStepUuid('other-slug', 'call-customer')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
    expect(uuidV5FromName('damage-intake/call-customer')).toBe(a)
  })

  it('compiles a linear document with condition, goto, and invoke', () => {
    const payload = compileProcedureDocument(SAMPLE)
    expect(payload.slug).toBe('damage-intake')
    expect(payload.title).toBe('Przyjęcie szkody')
    expect(payload.body).toContain('Proza dla operatora')
    expect(payload.body).not.toContain('## Procedure')
    expect(payload.contextTags).toEqual(['damage', 'collision'])
    expect(payload.defaultSlaDuration).toEqual({ amount: 3, unit: 'days' })
    expect(payload.procedureDefinition[0]?.kind).toBe('start')
    expect(payload.procedureDefinition.at(-1)?.kind).toBe('end')
    expect(payload.procedureDefinition[0]?.sourceStepId).toBe('start')

    const call = payload.procedureDefinition.find((b) => b.kind === 'action')
    expect(call?.kind).toBe('action')
    if (call?.kind === 'action') {
      expect(call.id).toBe(procedureStepUuid('damage-intake', 'call-customer'))
      expect(call.sourceStepId).toBe('call-customer')
      expect(call.actionVariant).toBe('notify')
    }

    const condition = payload.procedureDefinition.find((b) => b.kind === 'condition')
    expect(condition?.kind).toBe('condition')
    if (condition?.kind === 'condition') {
      expect(condition.yes[0]?.kind).toBe('invoke_procedure')
      expect(condition.no[0]?.kind).toBe('goto')
      if (condition.no[0]?.kind === 'goto') {
        expect(condition.no[0].targetStepId).toBe(procedureStepUuid('damage-intake', 'call-customer'))
      }
    }
  })

  it('accepts legacy blockId overrides but export omits them (identity is v5 from slug/id)', () => {
    const startId = newProcedureBlockId()
    const actionId = newProcedureBlockId()
    const endId = newProcedureBlockId()
    const md = `---
slug: custom-ids
title: Custom
---

## Procedure

- id: start
  blockId: ${startId}
  kind: start
- id: do-it
  blockId: ${actionId}
  kind: action
  label: Do it
  actionVariant: other
- id: end
  blockId: ${endId}
  kind: end
`
    const payload = compileProcedureDocument(md)
    expect(payload.procedureDefinition.map((b) => b.id)).toEqual([startId, actionId, endId])

    const exported = exportProcedureDocument(payload)
    expect(exported).not.toMatch(/blockId:/)
    const again = compileProcedureDocument(exported)
    expect(again.procedureDefinition.map((b) => b.id)).toEqual([
      procedureStepUuid('custom-ids', 'start'),
      procedureStepUuid('custom-ids', 'do-it'),
      procedureStepUuid('custom-ids', 'end'),
    ])
  })

  it('round-trips compile → export → compile preserving UUIDs and structure', () => {
    const first = compileProcedureDocument(SAMPLE)
    const md = exportProcedureDocument(first)
    expect(md).not.toMatch(/blockId:/)
    const second = compileProcedureDocument(md)
    expect(second.slug).toBe(first.slug)
    expect(second.title).toBe(first.title)
    expect(second.body).toContain('Proza dla operatora')
    expect(second.procedureDefinition.map((b) => b.id)).toEqual(
      first.procedureDefinition.map((b) => b.id),
    )
    const firstGoto = findGoto(first.procedureDefinition)
    const secondGoto = findGoto(second.procedureDefinition)
    expect(secondGoto?.targetStepId).toBe(firstGoto?.targetStepId)
  })

  it('exports UI-created blocks with synthetic local ids; re-import uses UUID v5', () => {
    const startId = newProcedureBlockId()
    const endId = newProcedureBlockId()
    const blocks: ProcedureBlock[] = [
      { id: startId, kind: 'start', label: 'Start' },
      { id: endId, kind: 'end', label: 'Koniec' },
    ]
    const md = exportProcedureDocument({
      slug: 'ui-made',
      title: 'UI made',
      body: 'Body',
      audience: 'internal',
      contextTags: [],
      defaultSlaDuration: null,
      recommendedOwnerUserIds: [],
      procedureDefinition: blocks,
    })
    expect(md).not.toMatch(/blockId:/)
    expect(md).toMatch(/id: start/)
    expect(md).toMatch(/id: koniec/)
    const reimported = compileProcedureDocument(md)
    expect(reimported.procedureDefinition.map((b) => b.id)).toEqual([
      procedureStepUuid('ui-made', 'start'),
      procedureStepUuid('ui-made', 'koniec'),
    ])
  })

  it('rejects missing Procedure section', () => {
    expect(() =>
      parseProcedureMarkdown(`---
slug: x
title: Y
---

# Only prose
`),
    ).toThrow(/missingProcedureSection/)
  })

  it('rejects unknown goto targets', () => {
    const md = `---
slug: x
title: Y
---

## Procedure

- id: start
  kind: start
- id: loop
  kind: goto
  target: missing-step
- id: end
  kind: end
`
    expect(() => compileProcedureDocument(md)).toThrow(/unknownGotoTarget/)
  })

  it('rejects documents that do not start with start', () => {
    const md = `---
slug: x
title: Y
---

## Procedure

- id: end
  kind: end
`
    expect(() => compileProcedureDocument(md)).toThrow()
  })

  it('compileProcedureSteps is deterministic across calls', () => {
    const parsed = parseProcedureMarkdown(SAMPLE)
    const once = compileProcedureSteps(parsed.meta.slug, parsed.steps)
    const twice = compileProcedureSteps(parsed.meta.slug, parsed.steps)
    expect(once).toEqual(twice)
  })
})

function findGoto(blocks: ProcedureBlock[]): Extract<ProcedureBlock, { kind: 'goto' }> | null {
  for (const block of blocks) {
    if (block.kind === 'goto') return block
    if (block.kind === 'condition') {
      const fromYes = findGoto(block.yes)
      if (fromYes) return fromYes
      const fromNo = findGoto(block.no)
      if (fromNo) return fromNo
    }
  }
  return null
}
