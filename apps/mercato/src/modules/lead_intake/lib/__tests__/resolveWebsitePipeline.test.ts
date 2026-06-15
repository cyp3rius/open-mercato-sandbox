import { matchPipelineIdByName, WEBSITE_PIPELINE_NAME } from '../resolveWebsitePipeline'

describe('resolveWebsitePipeline', () => {
  it('matches pipeline by name case-insensitively', () => {
    const pipelineId = matchPipelineIdByName(
      [
        { id: 'default-id', name: 'Default Pipeline' },
        { id: 'website-id', name: 'Website' },
      ],
      WEBSITE_PIPELINE_NAME,
    )
    expect(pipelineId).toBe('website-id')
  })

  it('returns null when website pipeline is missing', () => {
    const pipelineId = matchPipelineIdByName([{ id: 'default-id', name: 'Default Pipeline' }], WEBSITE_PIPELINE_NAME)
    expect(pipelineId).toBeNull()
  })
})
