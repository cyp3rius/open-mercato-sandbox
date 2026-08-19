'use client'

import * as React from 'react'
import { AlertTriangle, ListChecks } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { InlineTextEditor } from '@open-mercato/ui/backend/detail'
import { updateCrud } from '@open-mercato/ui/backend/utils/crud'
import type { SettlementTripSnapshot } from '../lib/settlementTripDistance'

type SettlementTripDistancePanelProps = {
  settlementId: string
  trips: SettlementTripSnapshot[]
  computedDistanceKm: string
  totalDistanceKm: string
  readOnly: boolean
  onUpdated: () => Promise<void>
  onOpenTripsTab?: () => void
}

function formatKm(value: string | number | null | undefined): string {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '—'
  return `${parsed.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} km`
}

function SettlementDistanceMetricBox({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="h-full rounded border border-border bg-muted/30 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function SettlementTripDistancePanel({
  settlementId,
  trips,
  computedDistanceKm,
  totalDistanceKm,
  readOnly,
  onUpdated,
  onOpenTripsTab,
}: SettlementTripDistancePanelProps) {
  const t = useT()

  const missingCount = trips.filter((trip) => trip.missingDistance).length
  const computedNumeric = Number(computedDistanceKm)
  const totalNumeric = Number(totalDistanceKm)
  const hasManualOverride =
    Number.isFinite(computedNumeric) &&
    Number.isFinite(totalNumeric) &&
    Math.abs(computedNumeric - totalNumeric) > 0.005

  const saveTotalDistance = async (next: string | null) => {
    const parsed = Number(String(next ?? '').replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(t('taxi_fleet.settlements.distance.invalidKm', 'Enter a valid distance in km.'))
    }
    await updateCrud(
      'taxi_fleet/settlements',
      { id: settlementId, totalDistanceKm: parsed },
      { errorMessage: t('taxi_fleet.settlements.form.saveError', 'Could not save settlement.') },
    )
    flash(t('taxi_fleet.settlements.form.updated', 'Changes saved.'), 'success')
    await onUpdated()
  }

  const missingAlert =
    missingCount > 0 ? (
      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          {t('taxi_fleet.settlements.distance.missingCount', '{count} trip(s) without distance.', {
            count: missingCount,
          })}
        </span>
      </div>
    ) : null

  return (
    <section className="space-y-4 rounded-lg border bg-card px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">
            {t('taxi_fleet.settlements.distance.title', 'Distance')}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(
              'taxi_fleet.settlements.distance.panelHint',
              'Sum of kilometres driven on trips this week vs. kilometres used for settlement.',
            )}
          </p>
        </div>
        {missingCount > 0 && onOpenTripsTab ? (
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={onOpenTripsTab}>
            <ListChecks className="mr-2 size-4 shrink-0" aria-hidden />
            {t('common.open', 'Open')}
          </Button>
        ) : null}
      </div>

      {missingAlert}

      <div className="grid gap-3 sm:grid-cols-2 sm:items-stretch">
        <SettlementDistanceMetricBox
          label={t('taxi_fleet.settlements.distance.computed', 'Computed from trips')}
          value={formatKm(computedDistanceKm)}
        />
        {readOnly ? (
          <SettlementDistanceMetricBox
            label={t('taxi_fleet.settlements.distance.totalEditable', 'Distance for settlement')}
            value={formatKm(totalDistanceKm)}
            hint={
              hasManualOverride
                ? t('taxi_fleet.settlements.distance.manualOverride', 'Manually adjusted')
                : undefined
            }
          />
        ) : (
          <div className="h-full min-h-0">
            <InlineTextEditor
              label={t('taxi_fleet.settlements.distance.totalEditable', 'Distance for settlement')}
              value={totalDistanceKm}
              emptyLabel="—"
              inputType="number"
              variant="muted"
              activateOnClick
              showEditTrigger
              validator={(value) => {
                const parsed = Number(value.replace(',', '.'))
                if (!Number.isFinite(parsed) || parsed < 0) {
                  return t('taxi_fleet.settlements.distance.invalidKm', 'Enter a valid distance in km.')
                }
                return null
              }}
              onSave={saveTotalDistance}
              renderDisplay={({ value }) => (
                <span className="text-lg font-semibold tabular-nums">{formatKm(value)}</span>
              )}
            />
            {hasManualOverride ? (
              <p className="mt-1 px-3 text-xs text-muted-foreground">
                {t('taxi_fleet.settlements.distance.manualOverride', 'Manually adjusted')}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  )
}
