import { collectLeadAttachmentInputs } from '../importLeadAttachments'

describe('collectLeadAttachmentInputs', () => {
  it('merges top-level attachments and strapi payload file lists by URL', () => {
    const collected = collectLeadAttachmentInputs(
      [{ sourceUrl: 'https://cdn.example.com/a.pdf', fileName: 'a.pdf' }],
      {
        files: [{ url: 'https://cdn.example.com/b.jpg', name: 'b.jpg' }],
        stagedMailAttachments: [{ url: 'https://cdn.example.com/a.pdf', filename: 'dup.pdf' }],
      },
    )

    expect(collected).toHaveLength(2)
    expect(collected[0]?.sourceUrl).toBe('https://cdn.example.com/a.pdf')
    expect(collected[1]?.sourceUrl).toBe('https://cdn.example.com/b.jpg')
  })

  it('ignores staged entries without downloadable URL', () => {
    const collected = collectLeadAttachmentInputs([], {
      stagedMailAttachments: [{ id: 12, filename: 'missing-url.pdf' }],
    })
    expect(collected).toHaveLength(0)
  })
})
