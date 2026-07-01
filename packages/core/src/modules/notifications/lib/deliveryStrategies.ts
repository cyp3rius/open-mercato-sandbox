import type React from 'react'
import type { Notification } from '../data/entities'
import type { NotificationDeliveryConfig } from './deliveryConfig'

export type NotificationDeliveryStrategyConfig = {
  enabled?: boolean
  config?: unknown
}

export type NotificationDeliveryRecipient = {
  email?: string | null
  name?: string | null
}

export type NotificationDeliveryContext = {
  notification: Notification
  recipient: NotificationDeliveryRecipient
  title: string
  body: string | null
  panelUrl: string | null
  panelLink: string | null
  actionLinks: Array<{ id: string; label: string; href: string }>
  deliveryConfig: NotificationDeliveryConfig
  config: NotificationDeliveryStrategyConfig
  resolve: <T = unknown>(name: string) => T
  t: (key: string, fallback?: string, variables?: Record<string, string>) => string
}

export type TransactionalEmailAttachment = {
  filename: string
  content: string
  contentType?: string
}

export type TransactionalEmailSendContext = {
  to: string
  subject: string
  react: React.ReactElement
  text?: string
  attachments?: TransactionalEmailAttachment[]
  deliveryConfig: NotificationDeliveryConfig
  config: NotificationDeliveryStrategyConfig
  resolve?: <T = unknown>(name: string) => T
}

export type NotificationDeliveryStrategy = {
  id: string
  label?: string
  defaultEnabled?: boolean
  deliver: (ctx: NotificationDeliveryContext) => Promise<void> | void
  sendTransactionalEmail?: (ctx: TransactionalEmailSendContext) => Promise<void> | void
}

type RegisteredStrategy = NotificationDeliveryStrategy & { priority: number }

const GLOBAL_KEY = '__openMercatoNotificationDeliveryStrategies__'

function readRegistry(): RegisteredStrategy[] {
  try {
    const existing = (globalThis as Record<string, unknown>)[GLOBAL_KEY]
    if (Array.isArray(existing)) {
      return existing as RegisteredStrategy[]
    }
  } catch {
    // ignore restricted globalThis environments
  }

  const registry: RegisteredStrategy[] = []
  try {
    ;(globalThis as Record<string, unknown>)[GLOBAL_KEY] = registry
  } catch {
    // ignore assignment failures
  }
  return registry
}

export function registerNotificationDeliveryStrategy(
  strategy: NotificationDeliveryStrategy,
  options?: { priority?: number }
): void {
  const priority = options?.priority ?? 0
  const registry = readRegistry()
  const next: RegisteredStrategy = { ...strategy, priority }
  const existingIndex = registry.findIndex((entry) => entry.id === strategy.id)
  if (existingIndex >= 0) {
    registry[existingIndex] = next
  } else {
    registry.push(next)
  }
  registry.sort((a, b) => b.priority - a.priority)
}

export function getNotificationDeliveryStrategies(): NotificationDeliveryStrategy[] {
  return readRegistry()
}

export type NotificationDeliveryStrategyDescriptor = {
  id: string
  label?: string
  defaultEnabled?: boolean
}

export function listNotificationDeliveryStrategyDescriptors(): NotificationDeliveryStrategyDescriptor[] {
  return readRegistry().map(({ id, label, defaultEnabled }) => ({ id, label, defaultEnabled }))
}
