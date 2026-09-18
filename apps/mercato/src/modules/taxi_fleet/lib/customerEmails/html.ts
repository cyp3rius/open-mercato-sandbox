export type CustomerEmailLocale = 'pl' | 'en'

export type TripEmailDetailRow = { label: string; value: string }

export type TripEmailDetailSection = {
  title?: string
  rows: TripEmailDetailRow[]
}

type EmailCta = {
  label: string
  href: string
}

type TripCustomerEmailHtmlInput = {
  locale: CustomerEmailLocale
  preheader: string
  heading: string
  intro: string[]
  sections: TripEmailDetailSection[]
  cta?: EmailCta
  footerNote?: string
}

const BRAND_GOLD = '#C9A227'
const BRAND_DARK = '#1C1917'
const TEXT_MUTED = '#57534E'
const BORDER = '#E7E5E4'
const BG = '#F5F5F4'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderParagraphs(paragraphs: string[]): string {
  return paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${BRAND_DARK};">${escapeHtml(paragraph)}</p>`,
    )
    .join('')
}

function renderDetailSections(sections: TripEmailDetailSection[]): string {
  return sections
    .map((section) => {
      const title = section.title
        ? `<tr><td colspan="2" style="padding:20px 0 8px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${TEXT_MUTED};">${escapeHtml(section.title)}</td></tr>`
        : ''
      const rows = section.rows
        .map((row, index) => {
          const borderTop = index === 0 && !section.title ? '' : `border-top:1px solid ${BORDER};`
          return `<tr>
  <td style="padding:10px 12px 10px 0;${borderTop}width:38%;font-size:14px;line-height:1.5;color:${TEXT_MUTED};vertical-align:top;">${escapeHtml(row.label)}</td>
  <td style="padding:10px 0;${borderTop}font-size:14px;line-height:1.5;color:${BRAND_DARK};vertical-align:top;font-weight:500;">${escapeHtml(row.value)}</td>
</tr>`
        })
        .join('')
      return `${title}${rows}`
    })
    .join('')
}

function renderCta(cta: EmailCta): string {
  const href = escapeHtml(cta.href)
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;">
  <tr>
    <td style="border-radius:999px;background:${BRAND_GOLD};">
      <a href="${href}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:${BRAND_DARK};text-decoration:none;">${escapeHtml(cta.label)}</a>
    </td>
  </tr>
</table>
<p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:${TEXT_MUTED};word-break:break-all;">
  <a href="${href}" style="color:${TEXT_MUTED};">${href}</a>
</p>`
}

export function buildTripCustomerEmailHtml(input: TripCustomerEmailHtmlInput): string {
  const { locale, preheader, heading, intro, sections, cta, footerNote } = input
  const footer =
    footerNote ??
    (locale === 'en'
      ? 'This is an automated message from RS Moto Taxi.'
      : 'To wiadomość automatyczna od RS Moto Taxi.')

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid ${BORDER};border-radius:16px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:28px 28px 20px;background:${BRAND_DARK};">
              <p style="margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${BRAND_GOLD};">RS Moto Taxi</p>
              <h1 style="margin:0;font-size:24px;line-height:1.3;font-weight:600;color:#FFFFFF;text-align:center;">${escapeHtml(heading)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              ${renderParagraphs(intro)}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                ${renderDetailSections(sections)}
              </table>
              ${cta ? renderCta(cta) : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 24px;background:#FAFAF9;border-top:1px solid ${BORDER};font-size:12px;line-height:1.6;color:${TEXT_MUTED};">
              ${escapeHtml(footer)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
