import { env, envBool, envInt } from '../env'

describe('env helpers', () => {
  const key = 'OM_TEST_ENV_HELPER'

  afterEach(() => {
    delete process.env[key]
  })

  it('reads required values and fallbacks', () => {
    expect(() => env(key)).toThrow(/Missing required/)
    expect(env(key, 'fallback')).toBe('fallback')
    process.env[key] = 'value'
    expect(env(key)).toBe('value')
  })

  it('parses booleans and ints', () => {
    expect(envBool(key, false)).toBe(false)
    process.env[key] = 'true'
    expect(envBool(key)).toBe(true)
    process.env[key] = '12'
    expect(envInt(key, 0)).toBe(12)
  })
})
