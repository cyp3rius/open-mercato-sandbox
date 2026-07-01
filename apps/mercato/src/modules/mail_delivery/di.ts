import type { AppContainer } from '@open-mercato/shared/lib/di/container'
import { registerNodemailerNotificationDeliveryStrategy } from './lib/nodemailerNotificationDelivery'

let registered = false

export function register(_container: AppContainer): void {
  if (registered) return
  registerNodemailerNotificationDeliveryStrategy()
  registered = true
}
