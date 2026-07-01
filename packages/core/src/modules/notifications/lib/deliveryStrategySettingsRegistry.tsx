'use client'

import type { ComponentType } from 'react'

export type NotificationDeliveryStrategySettingsProps = {
  config: Record<string, unknown>
  onConfigChange: (patch: Record<string, unknown>) => void
}

const registry = new Map<string, ComponentType<NotificationDeliveryStrategySettingsProps>>()

export function registerNotificationDeliveryStrategySettings(
  strategyId: string,
  component: ComponentType<NotificationDeliveryStrategySettingsProps>,
): void {
  registry.set(strategyId, component)
}

export function getNotificationDeliveryStrategySettingsComponent(
  strategyId: string,
): ComponentType<NotificationDeliveryStrategySettingsProps> | undefined {
  return registry.get(strategyId)
}
