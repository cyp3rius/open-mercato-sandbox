import { buildTripCustomerEmailHtml, resolveCustomerEmailLogoUrl } from '../html'

describe('customer email html', () => {
  const prevAppUrl = process.env.APP_URL
  const prevPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL

  afterEach(() => {
    if (prevAppUrl === undefined) delete process.env.APP_URL
    else process.env.APP_URL = prevAppUrl
    if (prevPublicAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = prevPublicAppUrl
  })

  it('resolves logo from APP_URL', () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    process.env.APP_URL = 'https://crm.example.com/'
    expect(resolveCustomerEmailLogoUrl()).toBe(
      'https://crm.example.com/driver/logo-rs-moto-taxi.png',
    )
  })

  it('embeds logo image when URL is available', () => {
    delete process.env.NEXT_PUBLIC_APP_URL
    process.env.APP_URL = 'https://crm.example.com'
    const html = buildTripCustomerEmailHtml({
      locale: 'pl',
      preheader: 'test',
      heading: 'Dokończ płatność',
      intro: ['Hej'],
      sections: [],
    })
    expect(html).toContain('src="https://crm.example.com/driver/logo-rs-moto-taxi.png"')
    expect(html).toContain('alt="RS Moto Taxi"')
  })

  it('falls back to text brand when logo URL is forced null', () => {
    const html = buildTripCustomerEmailHtml({
      locale: 'pl',
      preheader: 'test',
      heading: 'Dokończ płatność',
      intro: ['Hej'],
      sections: [],
      logoUrl: null,
    })
    expect(html).not.toContain('<img')
    expect(html).toContain('RS Moto Taxi')
  })
})
