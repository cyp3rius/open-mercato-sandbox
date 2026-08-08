"use client"

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Switch } from '@open-mercato/ui/primitives/switch'

type MobileAppAccessSwitchFieldProps = {
  value: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}

export function MobileAppAccessSwitchField({ value, onChange, disabled = false }: MobileAppAccessSwitchFieldProps) {
  const t = useT()

  return (
    <div className="flex w-full items-center justify-between gap-4 rounded-md border border-border/60 bg-background/80 px-3 py-3">
      <span className="text-sm font-medium">
        {t('taxi_fleet.drivers.mobileAppAccess', 'Access via mobile app')}
      </span>
      <Switch checked={value} onCheckedChange={onChange} disabled={disabled} className="shrink-0" />
    </div>
  )
}
