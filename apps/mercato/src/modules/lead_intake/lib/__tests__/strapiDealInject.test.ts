import {
  buildDealDescription,
  deriveDealTitle,
  isStrapiCooperationPayload,
  mapContactToPersonFields,
  mapStrapiCooperationPayloadToDeal,
  mapStrapiPayloadForDealInject,
} from '../strapiDealInject'

describe('strapiDealInject', () => {
  it('derives deal title from vehicle when fallback title is empty', () => {
    const title = deriveDealTitle('', {
      subject: { vehicle: { brandAndModel: 'Fiat Ducato', plateNumber: 'WA 12345' } },
    })
    expect(title).toBe('Fiat Ducato · WA 12345')
  })

  it('maps contact to person create fields', () => {
    const person = mapContactToPersonFields(
      {
        fullName: 'Jan Kowalski',
        email: 'jan@example.com',
        phone: '+48123456789',
      },
      'rsmotoconcierge-strapi',
    )
    expect(person).toMatchObject({
      firstName: 'Jan',
      lastName: 'Kowalski',
      displayName: 'Jan Kowalski',
      primaryEmail: 'jan@example.com',
      primaryPhone: '+48123456789',
      source: 'rsmotoconcierge-strapi',
    })
  })

  it('builds deal description from vehicle and contact', () => {
    const description = buildDealDescription({
      subject: { vehicle: { brandAndModel: 'Fiat Ducato', plateNumber: 'WA 12345' } },
      contact: { fullName: 'Jan Kowalski', email: 'jan@example.com', phone: '+48123456789', notes: 'Prefer email contact' },
    })
    expect(description).toBe(
      [
        'Imię i nazwisko: Jan Kowalski',
        'Pojazd: Fiat Ducato',
        'Rejestracja: WA 12345',
        'Telefon: +48123456789',
        'E-mail: jan@example.com',
        '',
        'Wiadomość:',
        'Prefer email contact',
      ].join('\n'),
    )
  })

  it('detects Strapi cooperation payload shape', () => {
    expect(
      isStrapiCooperationPayload({
        fullname: 'Anna Nowak',
        email: 'anna@example.com',
        message: 'Dealer cooperation',
      }),
    ).toBe(true)
    expect(isStrapiCooperationPayload({ stepOne: { brand: 'Fiat' }, stepFinal: { email: 'a@b.c' } })).toBe(false)
  })

  it('maps cooperation payload to deal fields', () => {
    const mapped = mapStrapiCooperationPayloadToDeal({
      strapiDocumentId: 'coop-doc-id-xyz',
      createdAt: '2026-06-15T10:30:00.000Z',
      fullname: 'Anna Nowak',
      email: 'anna.nowak@example.com',
      phone: '+48987654321',
      vehicle: 'Mercedes Sprinter Camper',
      message: 'Interesuje mnie współpraca dealerska w regionie mazowieckim.',
      consent: true,
      referralCode: { code: 'jan-kowalski', owner: 'Jan Kowalski' },
    })

    expect(mapped.referralCode).toBe('jankowalski')
    expect(mapped.referralOwnerName).toBe('Jan Kowalski')
    expect(mapped.payload.formKind).toBe('cooperation')
    expect(mapped.payload.contact).toMatchObject({
      fullName: 'Anna Nowak',
      email: 'anna.nowak@example.com',
      phone: '+48987654321',
    })
    expect(mapped.payload.subject?.vehicle).toMatchObject({ brandAndModel: 'Mercedes Sprinter Camper' })

    const title = deriveDealTitle('Zgłoszenie współpracy — Anna Nowak', mapped.payload)
    expect(title).toBe('Zgłoszenie współpracy — Anna Nowak')

    const description = buildDealDescription(mapped.payload)
    expect(description).toBe(
      [
        'Imię i nazwisko: Anna Nowak',
        'Pojazd: Mercedes Sprinter Camper',
        'Telefon: +48987654321',
        'E-mail: anna.nowak@example.com',
        '',
        'Wiadomość:',
        'Interesuje mnie współpraca dealerska w regionie mazowieckim.',
      ].join('\n'),
    )
  })

  it('routes cooperation payload through mapStrapiPayloadForDealInject', () => {
    const mapped = mapStrapiPayloadForDealInject({
      fullname: 'Anna Nowak',
      email: 'anna@example.com',
      message: 'Cooperation inquiry',
    })
    expect(mapped.payload.formKind).toBe('cooperation')
  })
})
