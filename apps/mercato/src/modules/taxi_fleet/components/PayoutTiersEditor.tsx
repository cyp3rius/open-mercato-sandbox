'use client'

import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import type { PayoutTier } from '../lib/payoutTiers'

type PayoutTiersEditorProps = {
  value: PayoutTier[]
  onChange: (next: PayoutTier[]) => void
  disabled?: boolean
}

function emptyTier(): PayoutTier {
  return { fromAmount: null, toAmount: null, percent: 0 }
}

function amountToInput(value: number | null): string {
  if (value == null) return ''
  return String(value)
}

function parseAmountInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed.length) return null
  const n = Number(trimmed.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function PayoutTiersEditor({ value, onChange, disabled = false }: PayoutTiersEditorProps) {
  const t = useT()
  const tiers = value.length ? value : [emptyTier()]

  const updateTier = (index: number, patch: Partial<PayoutTier>) => {
    const next = tiers.map((tier, tierIndex) => (tierIndex === index ? { ...tier, ...patch } : tier))
    onChange(next)
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs font-medium text-muted-foreground">
        <span>{t('taxi_fleet.drivers.payoutTiers.from', 'From')}</span>
        <span>{t('taxi_fleet.drivers.payoutTiers.to', 'To')}</span>
        <span>{t('taxi_fleet.drivers.payoutTiers.percent', 'Percent')}</span>
        <span className="sr-only">{t('common.actions', 'Actions')}</span>
      </div>
      {tiers.map((tier, index) => (
        <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
          <Input
            type="text"
            inputMode="decimal"
            value={amountToInput(tier.fromAmount)}
            disabled={disabled}
            placeholder={t('taxi_fleet.drivers.payoutTiers.openFrom', '0')}
            onChange={(event) => updateTier(index, { fromAmount: parseAmountInput(event.target.value) })}
          />
          <Input
            type="text"
            inputMode="decimal"
            value={amountToInput(tier.toAmount)}
            disabled={disabled}
            placeholder={t('taxi_fleet.drivers.payoutTiers.openTo', '∞')}
            onChange={(event) => updateTier(index, { toAmount: parseAmountInput(event.target.value) })}
          />
          <Input
            type="text"
            inputMode="decimal"
            value={String(tier.percent ?? '')}
            disabled={disabled}
            placeholder="0"
            onChange={(event) => {
              const n = Number(event.target.value.replace(',', '.'))
              updateTier(index, { percent: Number.isFinite(n) ? n : 0 })
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled || tiers.length <= 1}
            onClick={() => onChange(tiers.filter((_, tierIndex) => tierIndex !== index))}
            aria-label={t('taxi_fleet.drivers.payoutTiers.remove', 'Remove tier')}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => onChange([...tiers, emptyTier()])}
      >
        <Plus className="mr-1 size-4" />
        {t('taxi_fleet.drivers.payoutTiers.add', 'Add tier')}
      </Button>
      <p className="text-xs text-muted-foreground">
        {t(
          'taxi_fleet.drivers.payoutTiers.help',
          'Empty from = 0, empty to = unlimited. Ranges are [from, to). At settlement the matching tier for net amount is used.',
        )}
      </p>
    </div>
  )
}
