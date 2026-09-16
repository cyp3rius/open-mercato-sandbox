'use client'

import * as React from 'react'
import {
  getOutboxSyncCounts,
  listDriverOutboxItems,
  type DriverOutboxItem,
} from '../../lib/driverOffline/outbox'
import { useDriverOnlineStatus } from './useDriverOnlineStatus'

export function useDriverOutboxItems(pollMs = 4000): {
  items: DriverOutboxItem[]
  pending: number
  failed: number
  total: number
  reload: () => Promise<void>
} {
  const online = useDriverOnlineStatus()
  const [items, setItems] = React.useState<DriverOutboxItem[]>([])
  const [pending, setPending] = React.useState(0)
  const [failed, setFailed] = React.useState(0)

  const reload = React.useCallback(async () => {
    const next = await listDriverOutboxItems()
    const counts = await getOutboxSyncCounts()
    setItems(next)
    setPending(counts.pending)
    setFailed(counts.failed)
  }, [])

  React.useEffect(() => {
    let active = true
    const tick = async () => {
      await reload().catch(() => undefined)
      if (!active) return
    }
    void tick()
    const id = window.setInterval(() => void tick(), pollMs)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [online, pollMs, reload])

  return {
    items,
    pending,
    failed,
    total: pending + failed,
    reload,
  }
}
