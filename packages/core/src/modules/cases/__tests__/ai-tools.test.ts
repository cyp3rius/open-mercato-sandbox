import { aiTools } from '../ai-tools'

describe('cases ai-tools', () => {
  it('exports Wave 1 tool names', () => {
    expect(aiTools.map((tool) => tool.name).sort()).toEqual(
      [
        'cases_assign_owner',
        'cases_create_with_playbook',
        'cases_find',
        'cases_get',
        'cases_transition_stage',
      ].sort(),
    )
  })

  it('requires cases.view for find/get', () => {
    const find = aiTools.find((tool) => tool.name === 'cases_find')
    const get = aiTools.find((tool) => tool.name === 'cases_get')
    expect(find?.requiredFeatures).toEqual(['cases.view'])
    expect(get?.requiredFeatures).toEqual(['cases.view'])
  })

  it('parses create_with_playbook input when playbookSlug is set', () => {
    const tool = aiTools.find((tool) => tool.name === 'cases_create_with_playbook')
    expect(tool).toBeDefined()
    const parsed = tool!.inputSchema.parse({
      title: 'Onboarding',
      customerEntityId: '11111111-1111-4111-8111-111111111111',
      ownerUserId: '22222222-2222-4222-8222-222222222222',
      playbookSlug: 'welcome',
    })
    expect(parsed.playbookSlug).toBe('welcome')
  })
})
