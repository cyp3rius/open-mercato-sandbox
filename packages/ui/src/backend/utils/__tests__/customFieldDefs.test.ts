import { fetchCustomFieldDefs, fieldsetAppliesToResourceType, normalizeEntityIds } from '../customFieldDefs'

const createFetchStub = (payload: unknown) => {
  const json = jest.fn().mockResolvedValue(payload)
  return Object.assign(jest.fn().mockResolvedValue({ json }), { json })
}

describe('customFieldDefs utilities', () => {
  it('normalizes entity ids and removes duplicates', () => {
    expect(normalizeEntityIds([' alpha ', 'ALPHA', 'beta', null as any])).toEqual(['alpha', 'ALPHA', 'beta'])
  })

  it('fetches definitions via provided fetch implementation and sorts by priority', async () => {
    const stub = createFetchStub({
      items: [
        { key: 'b', priority: 5 },
        { key: 'a', priority: 1 },
        { key: 'c' },
      ],
    })
    const defs = await fetchCustomFieldDefs(['entity.one'], stub as unknown as typeof fetch)
    expect(stub).toHaveBeenCalledWith('/api/entities/definitions?entityId=entity.one', expect.any(Object))
    expect(defs.map((d) => d.key)).toEqual(['c', 'a', 'b'])
  })

  it('applies vehicle fieldset when resolved fieldset code matches scoped fieldset', () => {
    const internalTypeId = '11111111-1111-4111-8111-111111111111'
    const taxiTypeId = '22222222-2222-4222-8222-222222222222'
    const fieldset = {
      code: 'resources_resource_vehicle',
      resourceTypeIds: [internalTypeId],
    }

    expect(fieldsetAppliesToResourceType(fieldset, taxiTypeId)).toBe(false)
    expect(
      fieldsetAppliesToResourceType(fieldset, taxiTypeId, {
        resolvedFieldsetCode: 'resources_resource_vehicle',
      }),
    ).toBe(true)
  })
})
