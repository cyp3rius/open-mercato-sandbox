'use client'

import { registerNotificationDeliveryStrategySettings } from '@open-mercato/core/modules/notifications/lib/deliveryStrategySettingsRegistry'
import { NodemailerStrategySettings } from './NodemailerStrategySettings'
import { NODEMAILER_NOTIFICATION_STRATEGY_ID } from '../lib/constants'

registerNotificationDeliveryStrategySettings(NODEMAILER_NOTIFICATION_STRATEGY_ID, NodemailerStrategySettings)
