"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDown,
  Luggage,
  MapPin,
  Pencil,
  Users,
  Trash2,
  X,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { ScheduleItem } from '@open-mercato/ui/backend/schedule'
import { DictionaryAppearancePreview } from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'
import { LoadingMessage } from '@open-mercato/ui/backend/detail'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { formatMoneyDisplay } from '@open-mercato/shared/lib/numeric'
import { mapTripRowToFormValues, type TripFormValues } from './tripFormConfig'
import { TripCustomerPreview } from './TripCustomerPreview'
import { useFleetDriverDirectory } from './useFleetDriverDirectory'
import { useResourceLabels } from './useResourceLabels'
import { useTaxiFleetLabels } from './useTaxiFleetLabels'
import { useTripStatusDictionary } from './useTripStatusDictionary'
import { useTaxiFleetPermissions } from './useTaxiFleetPermissions'

type TripRow = {
  id: string
  teamMemberId?: string | null
  resourceId?: string | null
  tripType: string
  status: string
  customerPersonId?: string | null
  customerCompanyId?: string | null
  startedAt?: string | null
  endedAt?: string | null
  revenueAmount?: string | null
  currencyCode?: string | null
  distanceKm?: string | null
  notes?: string | null
  metadata?: Record<string, unknown> | null
}

type QuoteSnapshot = {
  currency?: string
  vehicleCategory?: string
  basePrice?: number
  totalPrice?: number
  surcharges?: Array<{ code: string; label: string; amount: number }>
  warnings?: string[]
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length ? value.trim() : null
}

function formatScheduleRange(startedAt?: string | null, endedAt?: string | null): string {
  if (!startedAt) return '—'
  try {
    const start = parseISO(startedAt)
    if (Number.isNaN(start.getTime())) return startedAt
    if (!endedAt) return format(start, 'dd.MM.yyyy HH:mm')
    const end = parseISO(endedAt)
    if (Number.isNaN(end.getTime())) return format(start, 'dd.MM.yyyy HH:mm')
    return `${format(start, 'dd.MM.yyyy HH:mm')} – ${format(end, 'HH:mm')}`
  } catch {
    return startedAt
  }
}

function parseQuoteSnapshot(json: string): QuoteSnapshot | null {
  const raw = json.trim()
  if (!raw.length) return null
  try {
    return JSON.parse(raw) as QuoteSnapshot
  } catch {
    return null
  }
}

function waypointList(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function DetailSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2.5 rounded-lg border bg-card/40 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-start gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 wrap-break-word font-medium text-foreground">{children}</dd>
    </div>
  )
}

function BoolYesNo({ value, t }: { value: boolean; t: (key: string, fallback: string) => string }) {
  return value ? t('common.yes', 'Yes') : t('common.no', 'No')
}

export type TripCalendarDetailsPanelProps = {
  open: boolean
  item: ScheduleItem | null
  onOpenChange: (open: boolean) => void
}

export function TripCalendarDetailsPanel({ open, item, onOpenChange }: TripCalendarDetailsPanelProps) {
  const t = useT()
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const { canManageTrips, isLoading: permissionsLoading } = useTaxiFleetPermissions()
  const { findDefinition } = useTripStatusDictionary()
  const { resolveName } = useFleetDriverDirectory()
  const { resolveTripTypeLabel } = useTaxiFleetLabels()
  const tripIdFromItem = readString(item?.metadata?.tripId)
  const [loading, setLoading] = React.useState(false)
  const [row, setRow] = React.useState<TripRow | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleDeleteTrip = React.useCallback(async () => {
    if (!tripIdFromItem) return
    if (!permissionsLoading && !canManageTrips) return
    const ok = await confirm({
      title: t('taxi_fleet.trips.list.deleteConfirm', 'Delete this trip?'),
      variant: 'destructive',
    })
    if (!ok) return
    setIsDeleting(true)
    try {
      await deleteCrud('taxi_fleet/trips', tripIdFromItem, {
        errorMessage: t('taxi_fleet.trips.list.deleteError', 'Failed to delete trip.'),
      })
      flash(t('taxi_fleet.trips.list.deleteSuccess', 'Trip deleted.'), 'success')
      onOpenChange(false)
      router.refresh()
    } finally {
      setIsDeleting(false)
    }
  }, [canManageTrips, confirm, onOpenChange, permissionsLoading, router, t, tripIdFromItem])

  const resourceIds = React.useMemo(
    () => (row?.resourceId ? [row.resourceId] : []),
    [row?.resourceId],
  )
  const { resolveLabel: resolveResourceLabel } = useResourceLabels(resourceIds)

  React.useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  React.useEffect(() => {
    if (!open || !tripIdFromItem) {
      setRow(null)
      setError(null)
      setLoading(false)
      return
    }
    const tripId = tripIdFromItem
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      const call = await apiCall<{ items: TripRow[] }>(
        `/api/taxi_fleet/trips?ids=${encodeURIComponent(tripId)}&page=1&pageSize=1`,
      )
      if (cancelled) return
      const loaded = Array.isArray(call.result?.items) ? call.result.items[0] ?? null : null
      if (!loaded) {
        setError(t('taxi_fleet.trips.detail.notFound', 'Trip not found.'))
        setRow(null)
      } else {
        setRow(loaded)
      }
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [open, t, tripIdFromItem])

  if (!open || !item) return null

  const formValues: TripFormValues | null = row
    ? mapTripRowToFormValues({
        teamMemberId: row.teamMemberId ?? '',
        resourceId: row.resourceId ?? '',
        customerPersonId: row.customerPersonId,
        customerCompanyId: row.customerCompanyId,
        tripType: row.tripType,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
        revenueAmount: row.revenueAmount,
        distanceKm: row.distanceKm,
        notes: row.notes,
        status: row.status,
        metadata: row.metadata,
      })
    : null

  const definition = row ? findDefinition(row.status) : undefined
  const quote = formValues ? parseQuoteSnapshot(formValues.quoteSnapshotJson) : null
  const currency = quote?.currency ?? row?.currencyCode ?? 'PLN'
  const stops = formValues ? waypointList(formValues.waypointAddresses) : []
  const driverName = row?.teamMemberId
    ? resolveName(row.teamMemberId)
    : readString(item.metadata?.driverName)
  const vehicleLabel = row?.resourceId
    ? resolveResourceLabel(row.resourceId)
    : readString(item.metadata?.vehicleLabel)
  const isAirport = formValues?.serviceType === 'airport'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" aria-hidden="true" />
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col border-l bg-background shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-label={t('taxi_fleet.calendar.panelTitle', 'Trip details')}
      >
        <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <div className="min-w-0 space-y-1">
            <h2 className="truncate font-semibold">
              {t('taxi_fleet.calendar.panelTitle', 'Trip details')}
            </h2>
            {definition ? (
              <DictionaryAppearancePreview
                color={definition.color}
                icon={definition.icon}
                label={definition.label}
                labelClassName="text-sm"
              />
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {tripIdFromItem ? (
              <IconButton
                type="button"
                variant="ghost"
                size="lg"
                aria-label={t('taxi_fleet.calendar.editTrip', 'Edit trip')}
                onClick={() => {
                  onOpenChange(false)
                  router.push(`/backend/taxi-fleet/trips/${tripIdFromItem}`)
                }}
              >
                <Pencil className="h-5 w-5" />
              </IconButton>
            ) : null}
            {tripIdFromItem && (permissionsLoading || canManageTrips) ? (
              <IconButton
                type="button"
                variant="outline"
                size="lg"
                aria-label={t('taxi_fleet.trips.list.deleteConfirm', 'Delete this trip?')}
                className="border-red-200 text-red-600 hover:bg-red-50"
                disabled={isDeleting}
                onClick={() => void handleDeleteTrip()}
              >
                <Trash2 className="h-5 w-5" aria-hidden />
              </IconButton>
            ) : null}
            <IconButton
              type="button"
              variant="ghost"
              size="lg"
              aria-label={t('taxi_fleet.calendar.closePanel', 'Close')}
              onClick={() => onOpenChange(false)}
            >
              <X className="h-5 w-5" />
            </IconButton>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {loading ? (
            <LoadingMessage label={t('taxi_fleet.trips.detail.loading', 'Loading…')} />
          ) : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {!loading && !error && formValues && row ? (
            <>
              <DetailSection title={t('taxi_fleet.trips.form.groups.basics', 'Assignment')}>
                <dl className="space-y-2">
                  <DetailRow label={t('taxi_fleet.assignments.driver', 'Driver')}>
                    {driverName || t('taxi_fleet.trips.unassigned', 'Unassigned')}
                  </DetailRow>
                  <DetailRow label={t('taxi_fleet.assignments.vehicle', 'Vehicle')}>
                    {vehicleLabel || '—'}
                  </DetailRow>
                  {formValues.vehicleCategory ? (
                    <DetailRow label={t('taxi_fleet.trips.form.vehicleCategory', 'Vehicle category')}>
                      {t(
                        `taxi_fleet.trips.form.vehicleCategories.${formValues.vehicleCategory}`,
                        formValues.vehicleCategory,
                      )}
                    </DetailRow>
                  ) : null}
                  <DetailRow label={t('taxi_fleet.calendar.tripKind', 'Trip kind')}>
                    {resolveTripTypeLabel(row.tripType)}
                  </DetailRow>
                  <DetailRow label={t('taxi_fleet.calendar.scheduleRange', 'Start/End')}>
                    {formatScheduleRange(row.startedAt, row.endedAt)}
                  </DetailRow>
                </dl>
              </DetailSection>

              <DetailSection title={t('taxi_fleet.trips.form.groups.route', 'Route')}>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden />
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">
                        {t('taxi_fleet.trips.form.fromAddress', 'From')}
                      </div>
                      <div className="font-medium">{formValues.fromAddress || '—'}</div>
                    </div>
                  </div>
                  {stops.map((stop, index) => (
                    <div key={`${stop}-${index}`} className="flex items-start gap-2 pl-0.5">
                      <ArrowDown className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">
                          {t('taxi_fleet.calendar.stopN', 'Stop {n}', { n: index + 1 })}
                        </div>
                        <div className="font-medium">{stop}</div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-rose-600" aria-hidden />
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">
                        {t('taxi_fleet.trips.form.toAddress', 'To')}
                      </div>
                      <div className="font-medium">{formValues.toAddress || '—'}</div>
                    </div>
                  </div>
                </div>
                <dl className="mt-3 space-y-2 border-t pt-3">
                  {formValues.distanceKm ? (
                    <DetailRow label={t('taxi_fleet.trips.form.distanceKm', 'Distance (km)')}>
                      {formValues.distanceKm}
                    </DetailRow>
                  ) : null}
                  {formValues.durationText ? (
                    <DetailRow label={t('taxi_fleet.trips.form.durationText', 'Estimated duration')}>
                      {formValues.durationText}
                    </DetailRow>
                  ) : null}
                </dl>
              </DetailSection>

              <DetailSection title={t('taxi_fleet.trips.form.groups.tripDetails', 'Trip details')}>
                <dl className="space-y-2">
                  <DetailRow label={t('taxi_fleet.trips.form.serviceType', 'Service type')}>
                    {t(
                      `taxi_fleet.trips.form.serviceTypes.${formValues.serviceType}`,
                      formValues.serviceType,
                    )}
                  </DetailRow>
                  <DetailRow label={t('taxi_fleet.trips.form.passengers', 'Passengers')}>
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" aria-hidden />
                      {formValues.passengers}
                    </span>
                  </DetailRow>
                  {isAirport ? (
                    <>
                      <DetailRow label={t('taxi_fleet.trips.form.handLuggage', 'Hand luggage')}>
                        <span className="inline-flex items-center gap-1">
                          <Luggage className="size-3.5" aria-hidden />
                          {formValues.handLuggage}
                        </span>
                      </DetailRow>
                      <DetailRow label={t('taxi_fleet.trips.form.holdLuggage', 'Hold luggage')}>
                        {formValues.holdLuggage}
                      </DetailRow>
                    </>
                  ) : null}
                  <DetailRow label={t('taxi_fleet.trips.form.childSeats', 'Child seats')}>
                    {formValues.childSeats}
                  </DetailRow>
                  <DetailRow label={t('taxi_fleet.trips.form.boosterSeats', 'Booster seats')}>
                    {formValues.boosterSeats}
                  </DetailRow>
                  <DetailRow label={t('taxi_fleet.trips.form.englishSpeakingDriver', 'English-speaking driver')}>
                    <BoolYesNo value={formValues.englishSpeakingDriver} t={t} />
                  </DetailRow>
                  {isAirport ? (
                    <>
                      <DetailRow label={t('taxi_fleet.trips.form.isAirportPickup', 'Airport pickup')}>
                        <BoolYesNo value={formValues.isAirportPickup} t={t} />
                      </DetailRow>
                      {formValues.isAirportPickup && formValues.flightNumber ? (
                        <DetailRow label={t('taxi_fleet.trips.form.flightNumber', 'Flight number')}>
                          {formValues.flightNumber}
                        </DetailRow>
                      ) : null}
                      <DetailRow label={t('taxi_fleet.trips.form.meetAndGreet', 'Meet & greet in arrivals hall')}>
                        <BoolYesNo value={formValues.meetAndGreet} t={t} />
                      </DetailRow>
                    </>
                  ) : null}
                </dl>
              </DetailSection>

              <DetailSection title={t('taxi_fleet.trips.form.groups.customer', 'Customer & billing')}>
                <dl className="space-y-2">
                  <DetailRow label={t('taxi_fleet.trips.customer', 'Customer')}>
                    <TripCustomerPreview
                      customerPersonId={row.customerPersonId}
                      customerCompanyId={row.customerCompanyId}
                      openInNewWindow
                    />
                  </DetailRow>
                  <DetailRow label={t('taxi_fleet.trips.form.contactType', 'Client type')}>
                    {t(
                      `taxi_fleet.trips.form.contactTypes.${formValues.contactType}`,
                      formValues.contactType,
                    )}
                  </DetailRow>
                  {formValues.contactName ? (
                    <DetailRow label={t('taxi_fleet.trips.form.contactName', 'Contact name')}>
                      {formValues.contactName}
                    </DetailRow>
                  ) : null}
                  {formValues.contactPhone ? (
                    <DetailRow label={t('taxi_fleet.trips.form.contactPhone', 'Phone')}>
                      <a className="text-primary hover:underline" href={`tel:${formValues.contactPhone}`}>
                        {formValues.contactPhone}
                      </a>
                    </DetailRow>
                  ) : null}
                  {formValues.contactEmail ? (
                    <DetailRow label={t('taxi_fleet.trips.form.contactEmail', 'Email')}>
                      <a className="text-primary hover:underline" href={`mailto:${formValues.contactEmail}`}>
                        {formValues.contactEmail}
                      </a>
                    </DetailRow>
                  ) : null}
                  {formValues.contactType === 'company' && formValues.companyName ? (
                    <DetailRow label={t('taxi_fleet.trips.form.companyName', 'Company name')}>
                      {formValues.companyName}
                    </DetailRow>
                  ) : null}
                  {formValues.contactType === 'company' && formValues.companyTaxId ? (
                    <DetailRow label={t('taxi_fleet.trips.form.companyTaxId', 'Tax ID')}>
                      {formValues.companyTaxId}
                    </DetailRow>
                  ) : null}
                  <DetailRow label={t('taxi_fleet.trips.form.paymentType', 'Payment method')}>
                    {t(
                      `taxi_fleet.trips.form.paymentTypes.${formValues.paymentType}`,
                      formValues.paymentType,
                    )}
                  </DetailRow>
                </dl>
              </DetailSection>

              <DetailSection title={t('taxi_fleet.trips.form.groups.pricing', 'Pricing')}>
                <dl className="space-y-2">
                  <DetailRow label={t('taxi_fleet.trips.form.finalPrice', 'Final price')}>
                    <span className="text-base font-semibold tabular-nums">
                      {formatMoneyDisplay(formValues.revenueAmount || null, { currency })}
                    </span>
                  </DetailRow>
                  {typeof quote?.basePrice === 'number' ? (
                    <DetailRow label={t('taxi_fleet.trips.form.quote.base', 'Base fare')}>
                      {formatMoneyDisplay(quote.basePrice, { currency })}
                    </DetailRow>
                  ) : null}
                  {typeof quote?.totalPrice === 'number' ? (
                    <DetailRow label={t('taxi_fleet.trips.form.quote.calculated', 'Calculated total')}>
                      {formatMoneyDisplay(quote.totalPrice, { currency })}
                    </DetailRow>
                  ) : null}
                </dl>
                {Array.isArray(quote?.surcharges) && quote.surcharges.length > 0 ? (
                  <div className="mt-3 space-y-1.5 border-t pt-3">
                    <div className="text-xs font-medium text-muted-foreground">
                      {t('taxi_fleet.trips.form.quote.surcharges', 'Surcharges')}
                    </div>
                    <ul className="space-y-1 text-sm">
                      {quote.surcharges.map((line) => (
                        <li key={line.code} className="flex items-baseline justify-between gap-3">
                          <span className="text-muted-foreground">{line.label}</span>
                          <span className="tabular-nums">
                            +{formatMoneyDisplay(line.amount, { currency })}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </DetailSection>

              {formValues.notes.trim() ? (
                <DetailSection title={t('taxi_fleet.trips.notes', 'Notes')}>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{formValues.notes}</p>
                </DetailSection>
              ) : null}
            </>
          ) : null}

          {!loading && !error && !formValues && !tripIdFromItem ? (
            <p className="text-sm text-muted-foreground">
              {t('taxi_fleet.calendar.noRoute', 'No route details')}
            </p>
          ) : null}
        </div>
      </div>
      {ConfirmDialogElement}
    </>
  )
}
