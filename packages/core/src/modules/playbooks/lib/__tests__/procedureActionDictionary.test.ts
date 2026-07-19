import { resolveProcedureActionVariant } from '../procedureActionDictionary'

describe('resolveProcedureActionVariant', () => {
  it('uses metadata legacy variant when present', () => {
    expect(resolveProcedureActionVariant('custom-code', 'task')).toBe('task')
  })

  it('falls back to known action codes', () => {
    expect(resolveProcedureActionVariant('notify', null)).toBe('notify')
    expect(resolveProcedureActionVariant('other', null)).toBe('other')
  })

  it('defaults unknown codes to other', () => {
    expect(resolveProcedureActionVariant('custom', null)).toBe('other')
  })
})
