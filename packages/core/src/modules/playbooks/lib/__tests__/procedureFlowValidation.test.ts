import { newProcedureBlockId, type ProcedureBlock } from '../procedureBlocks'
import { validateProcedureExecutionFlow } from '../procedureFlowValidation'

function id(): string {
  return newProcedureBlockId()
}

describe('validateProcedureExecutionFlow — loops allowed with exit', () => {
  it('accepts empty definition', () => {
    expect(validateProcedureExecutionFlow([])).toEqual({ ok: true })
  })

  it('accepts linear start → action → end', () => {
    const start = id()
    const action = id()
    const end = id()
    const blocks: ProcedureBlock[] = [
      { id: start, kind: 'start', label: '' },
      {
        id: action,
        kind: 'action',
        label: '',
        actionVariant: 'other',
        otherInstructions: 'do',
      },
      { id: end, kind: 'end', label: '' },
    ]
    expect(validateProcedureExecutionFlow(blocks)).toEqual({ ok: true })
  })

  it('accepts loop with conditional exit (goto back + end on other branch)', () => {
    const start = id()
    const stepA = id()
    const cond = id()
    const stepB = id()
    const end = id()
    const blocks: ProcedureBlock[] = [
      { id: start, kind: 'start', label: '' },
      {
        id: stepA,
        kind: 'action',
        label: 'A',
        actionVariant: 'other',
        otherInstructions: 'a',
      },
      {
        id: cond,
        kind: 'condition',
        label: 'retry?',
        conditionMode: 'manual',
        verificationUserId: null,
        yes: [
          {
            id: stepB,
            kind: 'goto',
            label: 'back',
            targetStepId: stepA,
          },
        ],
        no: [{ id: end, kind: 'end', label: '' }],
      },
    ]
    expect(validateProcedureExecutionFlow(blocks)).toEqual({ ok: true })
  })

  it('rejects closed loop with no terminal exit', () => {
    const start = id()
    const stepA = id()
    const stepB = id()
    const blocks: ProcedureBlock[] = [
      { id: start, kind: 'start', label: '' },
      {
        id: stepA,
        kind: 'action',
        label: 'A',
        actionVariant: 'other',
        otherInstructions: 'a',
      },
      { id: stepB, kind: 'goto', label: 'loop', targetStepId: stepA },
    ]
    expect(validateProcedureExecutionFlow(blocks)).toEqual({
      ok: false,
      code: 'playbooks.procedure.validation.flowDoesNotTerminate',
    })
  })

  it('does not emit flowCycle for legal loops', () => {
    const start = id()
    const stepA = id()
    const cond = id()
    const end = id()
    const blocks: ProcedureBlock[] = [
      { id: start, kind: 'start', label: '' },
      {
        id: stepA,
        kind: 'action',
        label: 'A',
        actionVariant: 'other',
        otherInstructions: 'a',
      },
      {
        id: cond,
        kind: 'condition',
        label: 'done?',
        conditionMode: 'manual',
        verificationUserId: null,
        yes: [{ id: end, kind: 'end', label: '' }],
        no: [{ id: id(), kind: 'goto', label: 'retry', targetStepId: stepA }],
      },
    ]
    const result = validateProcedureExecutionFlow(blocks)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      expect(result.code).not.toBe('playbooks.procedure.validation.flowCycle')
    }
  })
})
