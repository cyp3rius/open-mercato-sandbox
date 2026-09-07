import { asFunction } from 'awilix'
import type { AppContainer } from '@open-mercato/shared/lib/di/container'
import { getStorageDriverFactory } from './lib/drivers/driverFactory'

export function register(container: AppContainer) {
  container.register({
    storageDriverFactory: asFunction(() => getStorageDriverFactory()).singleton(),
  })
}
