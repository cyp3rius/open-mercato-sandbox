import { assignmentShiftSchema, driverLocationBatchSchema } from '../../data/validators'

describe('driver shift and location validators', () => {
  it('parses shift start/end with optional clientMutationId', () => {
    expect(
      assignmentShiftSchema.parse({
        id: '11111111-1111-4111-8111-111111111111',
        action: 'start',
        clientMutationId: 'm1',
      }),
    ).toMatchObject({ action: 'start', clientMutationId: 'm1' })
    expect(
      assignmentShiftSchema.parse({
        id: '11111111-1111-4111-8111-111111111111',
        action: 'end',
      }),
    ).toMatchObject({ action: 'end' })
  })

  it('rejects empty location batches and accepts bounded pings', () => {
    expect(() => driverLocationBatchSchema.parse({ pings: [] })).toThrow()
    const parsed = driverLocationBatchSchema.parse({
      pings: [
        {
          recordedAt: '2026-08-08T10:00:00.000Z',
          lat: 52.2,
          lon: 21.0,
          accuracyM: 12,
        },
      ],
      clientMutationId: 'loc-1',
    })
    expect(parsed.pings).toHaveLength(1)
    expect(parsed.clientMutationId).toBe('loc-1')
  })
})
