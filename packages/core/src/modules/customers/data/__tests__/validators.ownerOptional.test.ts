import {
  companyCreateSchema,
  dealCreateSchema,
  personCreateSchema,
} from '../validators'

const scope = {
  organizationId: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
}

describe('customer create schemas — optional guardian', () => {
  it('accepts person create without ownerUserId and with explicit null', () => {
    const without = personCreateSchema.safeParse({
      ...scope,
      displayName: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
    })
    expect(without.success).toBe(true)

    const withNull = personCreateSchema.safeParse({
      ...scope,
      displayName: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      ownerUserId: null,
    })
    expect(withNull.success).toBe(true)
    if (withNull.success) expect(withNull.data.ownerUserId).toBeNull()
  })

  it('accepts company create without ownerUserId and with explicit null', () => {
    const without = companyCreateSchema.safeParse({
      ...scope,
      displayName: 'Analytical Engines Sp. z o.o.',
    })
    expect(without.success).toBe(true)

    const withNull = companyCreateSchema.safeParse({
      ...scope,
      displayName: 'Analytical Engines Sp. z o.o.',
      ownerUserId: null,
    })
    expect(withNull.success).toBe(true)
    if (withNull.success) expect(withNull.data.ownerUserId).toBeNull()
  })

  it('still accepts a valid guardian UUID', () => {
    const ownerUserId = '33333333-3333-4333-8333-333333333333'
    const parsed = personCreateSchema.safeParse({
      ...scope,
      displayName: 'Ada Lovelace',
      firstName: 'Ada',
      lastName: 'Lovelace',
      ownerUserId,
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.ownerUserId).toBe(ownerUserId)
  })

  it('accepts deal create with null ownerUserId', () => {
    const parsed = dealCreateSchema.safeParse({
      ...scope,
      title: 'Pilot',
      ownerUserId: null,
    })
    expect(parsed.success).toBe(true)
  })
})
