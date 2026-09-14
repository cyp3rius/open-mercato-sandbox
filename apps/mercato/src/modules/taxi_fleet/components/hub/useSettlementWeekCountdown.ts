'use client'

import * as React from 'react'
import { endOfWeek, intervalToDuration } from 'date-fns'
import { useT, type TranslateFn } from '@open-mercato/shared/lib/i18n/context'

function formatWeekCountdown(
  parts: { days?: number; hours?: number; minutes?: number },
  t: TranslateFn,
): string {
  const days = parts.days ?? 0
  const hours = parts.hours ?? 0
  const minutes = parts.minutes ?? 0
  if (days > 0) {
    return t('taxi_fleet.hub.weeklySettlements.countdown.daysHours', '{days}d {hours}h', {
      days: String(days),
      hours: String(hours),
    })
  }
  if (hours > 0) {
    return t('taxi_fleet.hub.weeklySettlements.countdown.hoursMinutes', '{hours}h {minutes}m', {
      hours: String(hours),
      minutes: String(minutes),
    })
  }
  return t('taxi_fleet.hub.weeklySettlements.countdown.minutes', '{minutes}m', {
    minutes: String(Math.max(0, minutes)),
  })
}

/** Live countdown to the end of the current ISO week (Mon–Sun, weekStartsOn: 1). */
export function useSettlementWeekCountdown(tickMs = 30_000): string | null {
  const t = useT()
  const [label, setLabel] = React.useState<string | null>(null)

  React.useEffect(() => {
    function refresh() {
      const now = new Date()
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
      if (weekEnd.getTime() <= now.getTime()) {
        setLabel(t('taxi_fleet.hub.weeklySettlements.countdown.ended', 'Week ended'))
        return
      }
      const parts = intervalToDuration({ start: now, end: weekEnd })
      setLabel(
        t('taxi_fleet.hub.weeklySettlements.countdown.label', 'Week ends in {remaining}', {
          remaining: formatWeekCountdown(parts, t),
        }),
      )
    }
    refresh()
    const timer = window.setInterval(refresh, tickMs)
    return () => window.clearInterval(timer)
  }, [t, tickMs])

  return label
}
