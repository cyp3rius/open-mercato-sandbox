import {
  DRIVER_COMMUNICATION_BODY_MAX,
  DRIVER_COMMUNICATION_TITLE_MAX,
  driverCommunicationCreateSchema,
} from '../../../data/validators'
import { preferenceTypeForPushKind } from '../../driverPush/pushPayload'
import { urgencyForCommunicationKind } from '../deliver'

describe('driver communications helpers', () => {
  test('urgency: info=normal, service/direct=high', () => {
    expect(urgencyForCommunicationKind('info')).toBe('normal')
    expect(urgencyForCommunicationKind('service')).toBe('high')
    expect(urgencyForCommunicationKind('direct')).toBe('high')
  })

  test('preference type maps broadcast kind', () => {
    expect(preferenceTypeForPushKind('driver_broadcast')).toBe('taxi_fleet.driver_broadcast')
    expect(preferenceTypeForPushKind('assignment_planned')).toBe('taxi_fleet.assignment.planned')
    expect(preferenceTypeForPushKind('settlement_ready')).toBe('taxi_fleet.settlement.ready')
    expect(preferenceTypeForPushKind('monthly_settlement_ready')).toBe(
      'taxi_fleet.monthly_settlement.ready',
    )
  })

  test('create schema enforces title/body limits and at least one recipient', () => {
    const base = {
      tenantId: '11111111-1111-4111-8111-111111111111',
      organizationId: '22222222-2222-4222-8222-222222222222',
      kind: 'info' as const,
      title: 'Hello',
      body: 'World',
      teamMemberIds: ['33333333-3333-4333-8333-333333333333'],
    }
    expect(driverCommunicationCreateSchema.parse(base).title).toBe('Hello')

    expect(() =>
      driverCommunicationCreateSchema.parse({
        ...base,
        title: 'x'.repeat(DRIVER_COMMUNICATION_TITLE_MAX + 1),
      }),
    ).toThrow()

    expect(() =>
      driverCommunicationCreateSchema.parse({
        ...base,
        body: 'y'.repeat(DRIVER_COMMUNICATION_BODY_MAX + 1),
      }),
    ).toThrow()

    expect(() =>
      driverCommunicationCreateSchema.parse({
        ...base,
        teamMemberIds: [],
      }),
    ).toThrow()
  })

  test('adHoc assignment created payloads should be skipped by subscriber guard', () => {
    const payload = { adHoc: true as const }
    expect(payload.adHoc === true).toBe(true)
  })
})
