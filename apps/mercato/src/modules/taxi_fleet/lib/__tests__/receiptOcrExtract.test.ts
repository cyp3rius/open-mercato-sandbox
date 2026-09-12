jest.mock('ai', () => ({
  generateText: jest.fn(async () => ({
    text: JSON.stringify({
      documentNumber: 'W001776',
      grossAmount: 150,
      sellerNip: '945-218-91-52',
      buyerNip: null,
      confidence: 0.9,
      rawExcerpt: 'NIP: 945-218-91-52\nW001776',
    }),
  })),
}))

jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: () => () => ({ provider: 'openai-mock' }),
}))

jest.mock('fs/promises', () => ({
  readFile: jest.fn(async () => {
    throw new Error('fs.readFile should not be called for fileBuffer OCR')
  }),
}))

import { generateText } from 'ai'
import fs from 'fs/promises'
import {
  extractReceiptFieldsFromImage,
  isLocalAttachmentStorageDriver,
} from '../receiptOcrExtract'

describe('isLocalAttachmentStorageDriver', () => {
  it('treats local and legacyPublic as disk-backed', () => {
    expect(isLocalAttachmentStorageDriver('local')).toBe(true)
    expect(isLocalAttachmentStorageDriver('legacyPublic')).toBe(true)
    expect(isLocalAttachmentStorageDriver(null)).toBe(true)
    expect(isLocalAttachmentStorageDriver(undefined)).toBe(true)
    expect(isLocalAttachmentStorageDriver('')).toBe(true)
  })

  it('treats external drivers as non-local', () => {
    expect(isLocalAttachmentStorageDriver('google_drive')).toBe(false)
    expect(isLocalAttachmentStorageDriver('s3')).toBe(false)
  })
})

describe('extractReceiptFieldsFromImage with fileBuffer', () => {
  const prevOpenAi = process.env.OPENAI_API_KEY
  const prevAnthropic = process.env.ANTHROPIC_API_KEY
  const prevProvider = process.env.TAXI_FLEET_RECEIPT_OCR_PROVIDER

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test-openai-key'
    delete process.env.ANTHROPIC_API_KEY
    process.env.TAXI_FLEET_RECEIPT_OCR_PROVIDER = 'openai'
    jest.clearAllMocks()
  })

  afterAll(() => {
    if (prevOpenAi === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = prevOpenAi
    if (prevAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = prevAnthropic
    if (prevProvider === undefined) delete process.env.TAXI_FLEET_RECEIPT_OCR_PROVIDER
    else process.env.TAXI_FLEET_RECEIPT_OCR_PROVIDER = prevProvider
  })

  it('runs OCR from buffer without reading the filesystem', async () => {
    const result = await extractReceiptFieldsFromImage({
      fileBuffer: Buffer.from('fake-jpeg-bytes'),
      fileName: 'receipt.jpeg',
      mimeType: 'image/jpeg',
    })

    expect(fs.readFile).not.toHaveBeenCalled()
    expect(generateText).toHaveBeenCalledTimes(1)
    expect(result.fields.documentNumber).toBe('W001776')
    expect(result.fields.sellerNip).toBe('9452189152')
    expect(result.provider).toBe('openai')
  })
})
