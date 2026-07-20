import type { NotificationTypeDefinition } from '@open-mercato/shared/modules/notifications/types'

const mockCreate = jest.fn()
const mockCreateForFeature = jest.fn()
const mockResolveRecipients = jest.fn()
const mockShouldDeliver = jest.fn()

jest.mock('../notificationService', () => ({
  resolveNotificationService: () => ({
    create: mockCreate,
    createForFeature: mockCreateForFeature,
  }),
}))

jest.mock('../notificationPreferenceService', () => ({
  resolveRecipientsForNotificationType: (...args: unknown[]) => mockResolveRecipients(...args),
  shouldDeliverNotification: (...args: unknown[]) => mockShouldDeliver(...args),
}))

import {
  notifyBroadcastFromType,
  notifyFeatureUsersFromType,
  notifyOwnerOnCreateIfDifferentFromActor,
  notifyPersonalFromType,
} from '../moduleNotificationDelivery'

const sampleType: NotificationTypeDefinition = {
  type: 'example.entity.created',
  module: 'example',
  titleKey: 'example.notifications.created.title',
  bodyKey: 'example.notifications.created.body',
  icon: 'bell',
  severity: 'info',
}

const baseOptions = {
  notificationType: 'example.entity.created',
  types: [sampleType],
  tenantId: 'tenant-1',
  organizationId: 'org-1',
  sourceEntityType: 'example:entity',
  sourceEntityId: 'entity-1',
  linkHref: '/backend/example/entity-1',
  logLabel: 'example:entity-created-notification',
}

describe('moduleNotificationDelivery', () => {
  const ctx = {
    resolve: jest.fn((name: string) => {
      if (name === 'em') return { fork: jest.fn() }
      throw new Error(`unexpected resolve: ${name}`)
    }),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockCreate.mockResolvedValue({})
    mockCreateForFeature.mockResolvedValue([])
  })

  it('broadcasts to preference recipients', async () => {
    mockResolveRecipients.mockResolvedValue(['user-a', 'user-b'])

    await notifyBroadcastFromType(ctx, {
      ...baseOptions,
      titleVariables: { name: 'Widget' },
    })

    expect(mockResolveRecipients).toHaveBeenCalledWith(expect.anything(), 'tenant-1', 'example.entity.created')
    expect(mockCreate).toHaveBeenCalledTimes(2)
    expect(mockCreate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        recipientUserId: 'user-a',
        type: 'example.entity.created',
        titleVariables: { name: 'Widget' },
        linkHref: '/backend/example/entity-1',
      }),
      { tenantId: 'tenant-1', organizationId: 'org-1' },
    )
  })

  it('skips broadcast when type is missing', async () => {
    await notifyBroadcastFromType(ctx, {
      ...baseOptions,
      types: [],
    })
    expect(mockResolveRecipients).not.toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('delivers personal notifications when preference allows', async () => {
    mockShouldDeliver.mockResolvedValue(true)

    await notifyPersonalFromType(ctx, {
      ...baseOptions,
      recipientUserId: 'user-a',
      bodyVariables: { title: 'Hello' },
    })

    expect(mockShouldDeliver).toHaveBeenCalledWith(
      expect.anything(),
      'user-a',
      'tenant-1',
      'example.entity.created',
    )
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientUserId: 'user-a',
        bodyVariables: { title: 'Hello' },
      }),
      { tenantId: 'tenant-1', organizationId: 'org-1' },
    )
  })

  it('skips personal delivery when preference blocks', async () => {
    mockShouldDeliver.mockResolvedValue(false)

    await notifyPersonalFromType(ctx, {
      ...baseOptions,
      recipientUserId: 'user-a',
    })

    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('delivers feature notifications via role feature fan-out', async () => {
    await notifyFeatureUsersFromType(ctx, {
      ...baseOptions,
      requiredFeature: 'example.notify',
    })

    expect(mockCreateForFeature).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'example.entity.created',
        requiredFeature: 'example.notify',
        sourceEntityId: 'entity-1',
      }),
      { tenantId: 'tenant-1', organizationId: 'org-1' },
    )
  })

  it('skips owner-on-create when actor equals owner', async () => {
    mockShouldDeliver.mockResolvedValue(true)

    await notifyOwnerOnCreateIfDifferentFromActor(ctx, {
      ...baseOptions,
      ownerUserId: 'user-a',
      actorUserId: 'user-a',
    })

    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('notifies owner-on-create when actor differs', async () => {
    mockShouldDeliver.mockResolvedValue(true)

    await notifyOwnerOnCreateIfDifferentFromActor(ctx, {
      ...baseOptions,
      ownerUserId: 'user-b',
      actorUserId: 'user-a',
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ recipientUserId: 'user-b' }),
      { tenantId: 'tenant-1', organizationId: 'org-1' },
    )
  })

  it('notifies owner-on-create when actor is missing', async () => {
    mockShouldDeliver.mockResolvedValue(true)

    await notifyOwnerOnCreateIfDifferentFromActor(ctx, {
      ...baseOptions,
      ownerUserId: 'user-b',
      actorUserId: null,
    })

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ recipientUserId: 'user-b' }),
      { tenantId: 'tenant-1', organizationId: 'org-1' },
    )
  })
})
