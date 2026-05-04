/** Strips basic HTML to plain text for message bodies (WYSIWYG → API). */
export function htmlToPlainText(html: string): string {
  if (typeof document === 'undefined') {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  const d = document.createElement('div')
  d.innerHTML = html
  return (d.innerText || d.textContent || '').trim()
}

export function defaultHtmlFromNotifyBody(raw: string | null | undefined): string {
  const s = typeof raw === 'string' ? raw : ''
  const t = s.trim()
  if (!t.length) return '<p><br></p>'
  if (t.startsWith('<')) return t
  return `<p>${t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
}
