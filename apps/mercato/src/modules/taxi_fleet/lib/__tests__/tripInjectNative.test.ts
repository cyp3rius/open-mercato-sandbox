import { tripInjectSchema } from '../../data/validators'
import {
  buildTripScheduleFromInjectInput,
  isLegacyTripInjectEnvelope,
  toNativeTripInjectInputFromLegacyPayload,
  tripInjectHasDefinedCustomer,
  tripRequestDetailsFromInjectInput,
} from '../tripInjectNative'

const scope = {
  organizationId: '11111111-1111-4111-8111-111111111111',
  tenantId: '22222222-2222-4222-8222-222222222222',
}

describe('tripInject dual-mode schema', () => {
  it('accepts plain contact inject', () => {
    const parsed = tripInjectSchema.parse({
      ...scope,
      externalId: 'req-plain-1',
      fromAddress: 'Kraków, Rynek',
      toAddress: 'Kraków, Lotnisko',
      tripDate: '2026-08-04',
      tripTime: '14:30',
      revenueAmount: 45.5,
      paymentType: 'cash',
      contactName: 'Jan Kowalski',
      contactPhone: '500123456',
    })
    expect(tripInjectHasDefinedCustomer(parsed)).toBe(false)
    expect(parsed.paymentType).toBe('cash')
    expect(parsed.contactName).toBe('Jan Kowalski')
  })

  it('accepts defined customer inject without contact', () => {
    const parsed = tripInjectSchema.parse({
      ...scope,
      externalId: 'req-defined-1',
      fromAddress: 'A',
      toAddress: 'B',
      startedAt: '2026-08-04T14:30:00.000Z',
      customerPersonId: '33333333-3333-4333-8333-333333333333',
      paymentType: 'card',
      revenueAmount: 120,
    })
    expect(tripInjectHasDefinedCustomer(parsed)).toBe(true)
    expect(parsed.customerPersonId).toBe('33333333-3333-4333-8333-333333333333')
  })

  it('rejects when neither customer UUID nor contact is provided', () => {
    const result = tripInjectSchema.safeParse({
      ...scope,
      externalId: 'req-invalid-1',
      fromAddress: 'A',
      toAddress: 'B',
      tripDate: '2026-08-04',
      tripTime: '10:00',
    })
    expect(result.success).toBe(false)
  })

  it('rejects person + company UUID conflict', () => {
    const result = tripInjectSchema.safeParse({
      ...scope,
      externalId: 'req-conflict-1',
      fromAddress: 'A',
      toAddress: 'B',
      startedAt: '2026-08-04T14:30:00.000Z',
      customerPersonId: '33333333-3333-4333-8333-333333333333',
      customerCompanyId: '44444444-4444-4444-8444-444444444444',
    })
    expect(result.success).toBe(false)
  })

  it('requires companyName for plain company contact', () => {
    const result = tripInjectSchema.safeParse({
      ...scope,
      externalId: 'req-company-1',
      fromAddress: 'A',
      toAddress: 'B',
      tripDate: '2026-08-04',
      tripTime: '10:00',
      contactName: 'Ada Nowak',
      contactEmail: 'ada@example.com',
      contactType: 'company',
    })
    expect(result.success).toBe(false)
  })

  it('prefers defined customer when both UUID and contact are present', () => {
    const parsed = tripInjectSchema.parse({
      ...scope,
      externalId: 'req-both-1',
      fromAddress: 'A',
      toAddress: 'B',
      startedAt: '2026-08-04T14:30:00.000Z',
      customerEntityId: '55555555-5555-4555-8555-555555555555',
      contactName: 'Ignored',
      contactPhone: '500000000',
    })
    expect(tripInjectHasDefinedCustomer(parsed)).toBe(true)
  })
})

describe('legacy transporter adapter', () => {
  it('detects legacy envelope and maps to native plain inject', () => {
    const body = {
      ...scope,
      externalId: 'strapi-99',
      source: 'rsmototaxi-strapi',
      payload: {
        fromAddress: 'Kraków, Rynek',
        toAddress: 'Kraków, Lotnisko',
        tripDate: '2026-08-04',
        tripTime: '14:30',
        contactName: 'Jan Kowalski',
        contactPhone: '500123456',
        contactEmail: 'jan@example.com',
        totalPrice: 45.5,
        paymentType: 'cash',
      },
    }
    expect(isLegacyTripInjectEnvelope(body)).toBe(true)
    expect(
      isLegacyTripInjectEnvelope({
        ...scope,
        externalId: 'native-1',
        fromAddress: 'A',
        toAddress: 'B',
        payload: { ignored: true },
      }),
    ).toBe(false)

    const native = toNativeTripInjectInputFromLegacyPayload(body)
    const parsed = tripInjectSchema.parse(native)
    expect(parsed.externalId).toBe('strapi-99')
    expect(parsed.fromAddress).toBe('Kraków, Rynek')
    expect(parsed.contactPhone).toBe('500123456')
    expect(parsed.revenueAmount).toBe(45.5)
    expect(parsed.transporterPayload).toMatchObject({ fromAddress: 'Kraków, Rynek' })

    const schedule = buildTripScheduleFromInjectInput(parsed)
    expect(schedule.startedAt.toISOString()).toContain('2026-08-04')
    expect(schedule.endedAt.getTime()).toBeGreaterThan(schedule.startedAt.getTime())

    const details = tripRequestDetailsFromInjectInput(parsed, null)
    expect(details.paymentType).toBe('cash')
    expect(details.fromAddress).toBe('Kraków, Rynek')
  })
})
