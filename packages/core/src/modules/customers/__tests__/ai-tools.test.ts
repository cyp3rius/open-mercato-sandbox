import { aiTools } from '../ai-tools'

describe('customers ai-tools', () => {
  it('exports Wave 1 tool names', () => {
    expect(aiTools.map((tool) => tool.name).sort()).toEqual(
      [
        'customers_ensure_company',
        'customers_ensure_person',
        'customers_find',
        'customers_get',
      ].sort(),
    )
  })

  it('parses ensure_person input', () => {
    const tool = aiTools.find((entry) => entry.name === 'customers_ensure_person')
    expect(tool).toBeDefined()
    const parsed = tool!.inputSchema.parse({
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
    })
    expect(parsed.email).toBe('ada@example.com')
  })

  it('rejects ensure_person without names', () => {
    const tool = aiTools.find((entry) => entry.name === 'customers_ensure_person')
    expect(() =>
      tool!.inputSchema.parse({
        email: 'ada@example.com',
      }),
    ).toThrow()
  })
})
