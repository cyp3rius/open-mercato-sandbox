'use client'

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Badge } from '@open-mercato/ui/primitives/badge'
import {
  readPaidAt,
  readPaymentHash,
  readPaymentLink,
  readPaymentReference,
  readPaypalOrderId,
  readRequestId,
  readEnquiryStatus,
  resolvePaypalPaymentDisplayStatus,
  type PaypalPaymentDisplayStatus,
} from '../lib/tripPaymentMetadata'

type TripPaypalPaymentPanelProps = {
  tripId: string
  status?: string | null
  metadata?: Record<string, unknown> | null
}

function FieldCell(props: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={['min-w-0 space-y-1', props.className].filter(Boolean).join(' ')}>
      <div className="text-xs font-medium text-muted-foreground">{props.label}</div>
      <div className="text-sm break-all">{props.children}</div>
    </div>
  )
}

function statusBadgeVariant(
  status: PaypalPaymentDisplayStatus,
): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'paid') return 'default'
  if (status === 'awaiting_payment') return 'secondary'
  return 'outline'
}

export function TripPaypalPaymentPanel({ tripId, status, metadata }: TripPaypalPaymentPanelProps) {
  const t = useT()
  const trip = {
    id: tripId,
    status: status ?? '',
    metadata: metadata ?? null,
  }
  const displayStatus = resolvePaypalPaymentDisplayStatus(trip)
  const requestId = readRequestId(trip)
  const paymentHash = readPaymentHash(trip)
  const paymentLink = readPaymentLink(trip)
  const paypalOrderId = readPaypalOrderId(trip)
  const paymentReference = readPaymentReference(trip)
  const paidAt = readPaidAt(trip)
  const enquiryStatus = readEnquiryStatus(trip)

  const statusLabel =
    displayStatus === 'paid'
      ? t('taxi_fleet.trips.paypalPayment.status.paid', 'Paid')
      : displayStatus === 'awaiting_payment'
        ? t('taxi_fleet.trips.paypalPayment.status.awaitingPayment', 'Awaiting customer payment')
        : displayStatus === 'awaiting_approval'
          ? t('taxi_fleet.trips.paypalPayment.status.awaitingApproval', 'Awaiting approval')
          : t('taxi_fleet.trips.paypalPayment.status.unknown', 'Unknown')

  return (
    <section className="rounded-lg border bg-card px-4 py-3 space-y-3">
      <h2 className="text-sm font-semibold">
        {t('taxi_fleet.trips.paypalPayment.title', 'PayPal payment')}
      </h2>

      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        <FieldCell label={t('taxi_fleet.trips.paypalPayment.paymentStatus', 'Payment status')}>
          <Badge variant={statusBadgeVariant(displayStatus)}>{statusLabel}</Badge>
        </FieldCell>

        {enquiryStatus ? (
          <FieldCell label={t('taxi_fleet.trips.paypalPayment.enquiryStatus', 'Enquiry status')}>
            <span className="font-mono text-xs">{enquiryStatus}</span>
          </FieldCell>
        ) : null}

        <FieldCell label={t('taxi_fleet.trips.paypalPayment.requestId', 'Request ID')}>
          <span className="font-mono text-xs">{requestId}</span>
        </FieldCell>

        {paymentHash ? (
          <FieldCell label={t('taxi_fleet.trips.paypalPayment.paymentHash', 'Payment hash')}>
            <span className="font-mono text-xs">{paymentHash}</span>
          </FieldCell>
        ) : null}

        {paypalOrderId ? (
          <FieldCell label={t('taxi_fleet.trips.paypalPayment.orderId', 'PayPal order ID')}>
            <span className="font-mono text-xs">{paypalOrderId}</span>
          </FieldCell>
        ) : null}

        {paymentReference && paymentReference !== paypalOrderId ? (
          <FieldCell label={t('taxi_fleet.trips.paypalPayment.reference', 'Payment reference')}>
            <span className="font-mono text-xs">{paymentReference}</span>
          </FieldCell>
        ) : null}

        {paidAt ? (
          <FieldCell label={t('taxi_fleet.trips.paypalPayment.paidAt', 'Paid at')}>
            {new Date(paidAt).toLocaleString()}
          </FieldCell>
        ) : null}

        {paymentLink && displayStatus !== 'paid' ? (
          <FieldCell
            className="col-span-2"
            label={t('taxi_fleet.trips.paypalPayment.paymentLink', 'Payment link')}
          >
            <a
              href={paymentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              {t('taxi_fleet.trips.paypalPayment.openLink', 'Open PayPal checkout')}
            </a>
          </FieldCell>
        ) : null}
      </div>
    </section>
  )
}
