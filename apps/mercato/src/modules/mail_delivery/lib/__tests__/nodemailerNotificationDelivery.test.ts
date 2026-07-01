import type { NotificationDeliveryContext } from '@open-mercato/core/modules/notifications/lib/deliveryStrategies'

const renderMock = jest.fn(async () => '<html>notification</html>')
const sendMailMock = jest.fn(async () => ({ messageId: 'msg-1' }))
const createTransportMock = jest.fn(() => ({ sendMail: sendMailMock }))

jest.mock('@react-email/render', () => ({
  render: (...args: unknown[]) => renderMock(...args),
}))

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: (...args: unknown[]) => createTransportMock(...args),
  },
}))

jest.mock('@open-mercato/core/modules/notifications/emails/NotificationEmail', () => ({
  __esModule: true,
  default: jest.fn((props: unknown) => props),
}))

describe('deliverNotificationViaNodemailer', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      EMAIL_FROM: 'notifications@example.com',
    }
    delete process.env.SMTP_HOST
    delete process.env.NODEMAILER_TRANSPORT
    delete process.env.OM_DISABLE_EMAIL_DELIVERY
    renderMock.mockClear()
    sendMailMock.mockClear()
    createTransportMock.mockClear()
    jest.resetModules()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  async function loadSubject() {
    const config = await import('../nodemailerConfig')
    config.resetNodemailerTransportCache()
    return import('../nodemailerNotificationDelivery')
  }

  function buildContext(overrides: Partial<NotificationDeliveryContext> = {}): NotificationDeliveryContext {
    return {
      notification: { id: 'n-1', recipientUserId: 'u-1' } as NotificationDeliveryContext['notification'],
      recipient: { email: 'recipient@example.com', name: 'Recipient' },
      title: 'Test notification',
      body: 'Body text',
      panelUrl: 'https://crm.example.com/backend/notifications',
      panelLink: 'https://crm.example.com/backend/notifications?notificationId=n-1',
      actionLinks: [{ id: 'open', label: 'Open', href: 'https://crm.example.com/backend/deals/1' }],
      deliveryConfig: {
        panelPath: '/backend/notifications',
        strategies: { database: { enabled: true }, email: { enabled: false } },
      },
      config: { enabled: true, config: {} },
      resolve: jest.fn(),
      t: (_key: string, fallback?: string) => fallback ?? _key,
      ...overrides,
    }
  }

  it('uses sendmail transport by default', async () => {
    const { deliverNotificationViaNodemailer } = await loadSubject()

    await deliverNotificationViaNodemailer(buildContext())

    expect(createTransportMock).toHaveBeenCalledWith({ sendmail: true })
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'notifications@example.com',
        to: 'recipient@example.com',
        subject: 'Test notification',
        html: '<html>notification</html>',
      }),
    )
  })

  it('sends HTML email via SMTP transport when configured', async () => {
    process.env.NODEMAILER_TRANSPORT = 'smtp'
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_PORT = '587'
    process.env.SMTP_USER = 'user@example.com'
    process.env.SMTP_PASS = 'secret'
    const { deliverNotificationViaNodemailer } = await loadSubject()

    await deliverNotificationViaNodemailer(buildContext())

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.example.com',
        port: 587,
        auth: { user: 'user@example.com', pass: 'secret' },
      }),
    )
  })

  it('implicitly selects smtp when SMTP_HOST is set without NODEMAILER_TRANSPORT', async () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    const { deliverNotificationViaNodemailer } = await loadSubject()

    await deliverNotificationViaNodemailer(buildContext())

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.example.com' }),
    )
  })

  it('applies subject prefix from env', async () => {
    process.env.NOTIFICATIONS_EMAIL_SUBJECT_PREFIX = '[CRM]'
    const { deliverNotificationViaNodemailer } = await loadSubject()

    await deliverNotificationViaNodemailer(buildContext())

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: '[CRM] Test notification',
      }),
    )
  })

  it('skips delivery when recipient email is missing', async () => {
    const { deliverNotificationViaNodemailer } = await loadSubject()

    await deliverNotificationViaNodemailer(buildContext({ recipient: { email: null, name: null } }))

    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('skips delivery when email delivery is disabled in test mode', async () => {
    process.env.OM_DISABLE_EMAIL_DELIVERY = '1'
    const { deliverNotificationViaNodemailer } = await loadSubject()

    await deliverNotificationViaNodemailer(buildContext())

    expect(sendMailMock).not.toHaveBeenCalled()
  })

  it('throws when smtp transport is selected without SMTP host', async () => {
    process.env.NODEMAILER_TRANSPORT = 'smtp'
    const { deliverNotificationViaNodemailer } = await loadSubject()

    await expect(deliverNotificationViaNodemailer(buildContext())).rejects.toThrow('NODEMAILER_SMTP_NOT_CONFIGURED')
  })
})

describe('resolveNodemailerStrategyConfig', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.SMTP_HOST
    delete process.env.NODEMAILER_TRANSPORT
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('defaults to sendmail transport', async () => {
    const { resolveNodemailerStrategyConfig } = await import('../nodemailerConfig')
    expect(resolveNodemailerStrategyConfig({}).transport).toBe('sendmail')
  })

  it('merges strategy config overrides over env defaults', async () => {
    process.env.SMTP_HOST = 'env-host'
    process.env.SMTP_PORT = '465'
    process.env.EMAIL_FROM = 'env-from@example.com'

    const { resolveNodemailerStrategyConfig } = await import('../nodemailerConfig')
    const resolved = resolveNodemailerStrategyConfig({
      transport: 'smtp',
      host: 'override-host',
      port: 2525,
      from: 'override-from@example.com',
      subjectPrefix: '[Override]',
    })

    expect(resolved.transport).toBe('smtp')
    expect(resolved.host).toBe('override-host')
    expect(resolved.port).toBe(2525)
    expect(resolved.from).toBe('override-from@example.com')
    expect(resolved.subjectPrefix).toBe('[Override]')
  })
})

describe('buildNodemailerTransportTarget', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    jest.resetModules()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('builds sendmail options with path and args', async () => {
    const { resolveNodemailerStrategyConfig } = await import('../nodemailerConfig')
    const { buildNodemailerTransportTarget } = await import('../nodemailerTransport')

    const config = resolveNodemailerStrategyConfig({
      transport: 'sendmail',
      sendmailPath: '/usr/local/bin/sendmail',
      sendmailArgs: ['-i', '-t'],
    })

    expect(buildNodemailerTransportTarget(config)).toEqual({
      sendmail: {
        path: '/usr/local/bin/sendmail',
        args: ['-i', '-t'],
      },
    })
  })

  it('builds url transport target string', async () => {
    const { resolveNodemailerStrategyConfig } = await import('../nodemailerConfig')
    const { buildNodemailerTransportTarget } = await import('../nodemailerTransport')

    const config = resolveNodemailerStrategyConfig({
      transport: 'url',
      url: 'smtp://user:pass@smtp.example.com:587',
    })

    expect(buildNodemailerTransportTarget(config)).toBe('smtp://user:pass@smtp.example.com:587')
  })

  it('builds service transport options', async () => {
    const { resolveNodemailerStrategyConfig } = await import('../nodemailerConfig')
    const { buildNodemailerTransportTarget } = await import('../nodemailerTransport')

    const config = resolveNodemailerStrategyConfig({
      transport: 'service',
      service: 'gmail',
      user: 'user@example.com',
      pass: 'secret',
    })

    expect(buildNodemailerTransportTarget(config)).toEqual({
      service: 'gmail',
      auth: { user: 'user@example.com', pass: 'secret' },
    })
  })

  it('builds raw options transport from JSON env', async () => {
    process.env.NODEMAILER_TRANSPORT = 'options'
    process.env.NODEMAILER_TRANSPORT_OPTIONS = '{"json":true}'

    const { resolveNodemailerStrategyConfig } = await import('../nodemailerConfig')
    const { buildNodemailerTransportTarget } = await import('../nodemailerTransport')

    expect(buildNodemailerTransportTarget(resolveNodemailerStrategyConfig({}))).toEqual({ json: true })
  })

  it('builds stream transport options', async () => {
    const { resolveNodemailerStrategyConfig } = await import('../nodemailerConfig')
    const { buildNodemailerTransportTarget } = await import('../nodemailerTransport')

    const config = resolveNodemailerStrategyConfig({ transport: 'stream' })

    expect(buildNodemailerTransportTarget(config)).toEqual({
      streamTransport: true,
      buffer: true,
      newline: 'unix',
    })
  })
})
