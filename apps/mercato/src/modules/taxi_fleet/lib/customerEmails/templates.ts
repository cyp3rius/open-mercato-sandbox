import type { TaxiFleetTrip } from '../../data/entities'
import { tripPaymentTypeNotesLabelPl, tripRequestDetailsFromMetadata } from '../tripRequestForm'
import { readRequestId, readTripLocale, readTripTotalPrice } from '../tripPaymentMetadata'
import type { CustomerEmailLocale, TripEmailDetailSection } from './html'
import { buildTripCustomerEmailHtml } from './html'

function formatPrice(value: number, currency: string, locale: CustomerEmailLocale): string {
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'pl-PL', {
    style: 'currency',
    currency,
  }).format(value)
}

function boolLabel(value: boolean, locale: CustomerEmailLocale): string {
  if (locale === 'en') return value ? 'Yes' : 'No'
  return value ? 'Tak' : 'Nie'
}

function paymentTypeLabel(paymentType: string, locale: CustomerEmailLocale): string {
  if (paymentType === 'electronic') {
    return locale === 'en' ? 'Online (PayPal)' : 'Elektronicznie (PayPal)'
  }
  if (paymentType === 'cash') {
    return locale === 'en' ? 'Cash to driver' : 'Gotówką u kierowcy'
  }
  if (paymentType === 'card') {
    return locale === 'en' ? 'Card to driver' : 'Kartą u kierowcy'
  }
  return tripPaymentTypeNotesLabelPl(paymentType) ?? paymentType
}

export function buildTripEmailDetailSections(
  trip: TaxiFleetTrip,
  currency: string,
): TripEmailDetailSection[] {
  const locale = readTripLocale(trip)
  const details = tripRequestDetailsFromMetadata(trip.metadata ?? null, {
    distanceKm: trip.distanceKm,
    revenueAmount: trip.revenueAmount,
  })
  const total = readTripTotalPrice(trip)
  const waypoints = details.waypointAddresses
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const routeRows = [
    { label: locale === 'en' ? 'From' : 'Skąd', value: details.fromAddress || '—' },
    { label: locale === 'en' ? 'To' : 'Dokąd', value: details.toAddress || '—' },
  ]
  if (waypoints.length) {
    routeRows.push({
      label: locale === 'en' ? 'Via' : 'Przez',
      value: waypoints.join(', '),
    })
  }

  return [
    {
      title: locale === 'en' ? 'Trip' : 'Kurs',
      rows: [
        { label: locale === 'en' ? 'Request ID' : 'ID zlecenia', value: readRequestId(trip) },
        {
          label: locale === 'en' ? 'Service' : 'Usługa',
          value:
            details.serviceType === 'airport'
              ? locale === 'en'
                ? 'Airport transfer'
                : 'Transfer lotniskowy'
              : locale === 'en'
                ? 'Local trip'
                : 'Kurs lokalny',
        },
        {
          label: locale === 'en' ? 'Vehicle' : 'Pojazd',
          value: details.vehicleCategory || '—',
        },
        {
          label: locale === 'en' ? 'Distance' : 'Dystans',
          value: details.distanceKm ? `${details.distanceKm} km` : '—',
        },
        {
          label: locale === 'en' ? 'Passengers' : 'Pasażerowie',
          value: details.passengers || '—',
        },
        {
          label: locale === 'en' ? 'Payment' : 'Płatność',
          value: paymentTypeLabel(details.paymentType, locale),
        },
        {
          label: locale === 'en' ? 'Total' : 'Suma',
          value: formatPrice(total, currency || trip.currencyCode || 'PLN', locale),
        },
      ],
    },
    {
      title: locale === 'en' ? 'Route' : 'Trasa',
      rows: routeRows,
    },
    {
      title: locale === 'en' ? 'Contact' : 'Kontakt',
      rows: [
        {
          label: locale === 'en' ? 'Type' : 'Typ',
          value:
            details.contactType === 'company'
              ? locale === 'en'
                ? 'Company'
                : 'Firma'
              : locale === 'en'
                ? 'Private'
                : 'Osoba prywatna',
        },
        { label: locale === 'en' ? 'Name' : 'Imię i nazwisko', value: details.contactName || '—' },
        { label: locale === 'en' ? 'Phone' : 'Telefon', value: details.contactPhone || '—' },
        { label: locale === 'en' ? 'Email' : 'E-mail', value: details.contactEmail || '—' },
        ...(details.contactType === 'company'
          ? [
              { label: locale === 'en' ? 'Company' : 'Firma', value: details.companyName || '—' },
              { label: 'NIP', value: details.companyTaxId || '—' },
            ]
          : []),
      ],
    },
    {
      title: locale === 'en' ? 'Extras' : 'Dodatki',
      rows: [
        {
          label: locale === 'en' ? 'Meet & greet' : 'Spotkanie z tabliczką',
          value: boolLabel(details.meetAndGreet, locale),
        },
        {
          label: locale === 'en' ? 'English-speaking driver' : 'Kierowca EN',
          value: boolLabel(details.englishSpeakingDriver, locale),
        },
        {
          label: locale === 'en' ? 'Child seats' : 'Foteliki',
          value: details.childSeats || '0',
        },
        {
          label: locale === 'en' ? 'Boosters' : 'Podwyższenia',
          value: details.boosterSeats || '0',
        },
        ...(details.flightNumber
          ? [{ label: locale === 'en' ? 'Flight' : 'Lot', value: details.flightNumber }]
          : []),
      ],
    },
  ]
}

export function buildPaymentLinkCustomerEmail(params: {
  trip: TaxiFleetTrip
  currency: string
  paymentLink: string
}): { subject: string; html: string } {
  const locale = readTripLocale(params.trip)
  const requestId = readRequestId(params.trip)
  const isEn = locale === 'en'
  return {
    subject: isEn
      ? `Complete payment for trip ${requestId}`
      : `Dokończ płatność za kurs ${requestId}`,
    html: buildTripCustomerEmailHtml({
      locale,
      preheader: isEn
        ? `Complete payment for trip request ${requestId}`
        : `Dokończ płatność za zlecenie kursu ${requestId}`,
      heading: isEn ? 'Complete your payment' : 'Dokończ płatność',
      intro: [
        isEn
          ? `Your trip request ${requestId} has been approved by our operator.`
          : `Twoje zlecenie kursu ${requestId} zostało zaakceptowane przez operatora.`,
        isEn
          ? 'Please complete the payment using the button below.'
          : 'Opłać kurs, klikając poniższy przycisk.',
      ],
      sections: buildTripEmailDetailSections(params.trip, params.currency),
      cta: {
        label: isEn ? 'Pay now' : 'Opłać teraz',
        href: params.paymentLink,
      },
    }),
  }
}

export function buildPaidCustomerEmail(params: {
  trip: TaxiFleetTrip
  currency: string
  driverPayment: boolean
  confirmationUrl?: string | null
}): { subject: string; html: string } {
  const locale = readTripLocale(params.trip)
  const requestId = readRequestId(params.trip)
  const isEn = locale === 'en'

  if (params.driverPayment) {
    return {
      subject: isEn
        ? `Trip ${requestId} confirmed — pay the driver`
        : `Kurs ${requestId} potwierdzony — płatność u kierowcy`,
      html: buildTripCustomerEmailHtml({
        locale,
        preheader: isEn
          ? `Trip ${requestId} confirmed — pay the driver`
          : `Kurs ${requestId} potwierdzony — płatność u kierowcy`,
        heading: isEn ? 'Trip confirmed' : 'Kurs potwierdzony',
        intro: [
          isEn
            ? `Your trip request ${requestId} has been approved by our operator.`
            : `Twój kurs ${requestId} został potwierdzony przez operatora.`,
          isEn
            ? 'No online payment was taken – you will pay the driver (cash or card). We will contact you with further details.'
            : 'Nie pobraliśmy płatności online – rozliczysz się z kierowcą (gotówką lub kartą). Skontaktujemy się z dalszymi informacjami.',
        ],
        sections: buildTripEmailDetailSections(params.trip, params.currency),
        ...(params.confirmationUrl
          ? {
              cta: {
                label: isEn ? 'View booking confirmation' : 'Zobacz potwierdzenie kursu',
                href: params.confirmationUrl,
              },
            }
          : {}),
      }),
    }
  }

  return {
    subject: isEn ? `Payment received — trip ${requestId}` : `Płatność otrzymana — kurs ${requestId}`,
    html: buildTripCustomerEmailHtml({
      locale,
      preheader: isEn
        ? `Payment received for trip ${requestId}`
        : `Otrzymaliśmy płatność za kurs ${requestId}`,
      heading: isEn ? 'Payment confirmed' : 'Płatność potwierdzona',
      intro: [
        isEn
          ? `Thank you — we have received your payment for trip ${requestId}.`
          : `Dziękujemy — otrzymaliśmy płatność za kurs ${requestId}.`,
        isEn
          ? 'Our team will contact you with the next steps.'
          : 'Nasz zespół skontaktuje się z dalszymi szczegółami.',
      ],
      sections: buildTripEmailDetailSections(params.trip, params.currency),
      ...(params.confirmationUrl
        ? {
            cta: {
              label: isEn ? 'View booking confirmation' : 'Zobacz potwierdzenie kursu',
              href: params.confirmationUrl,
            },
          }
        : {}),
    }),
  }
}
