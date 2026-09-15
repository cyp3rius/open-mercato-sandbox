/**
 * Install driver-PWA head tags and remove CRM/root branding icons that would
 * otherwise win on iOS "Add to Home Screen" (first apple-touch-icon in document).
 */
export const DRIVER_PWA_ICON_VERSION = '20260915b'

const DRIVER_MANIFEST_HREF = `/driver/manifest.webmanifest?v=${DRIVER_PWA_ICON_VERSION}`
const DRIVER_APPLE_TOUCH_HREF = `/driver/apple-touch-icon.png?v=${DRIVER_PWA_ICON_VERSION}`
const DRIVER_FAVICON_HREF = `/driver/icon-192.png?v=${DRIVER_PWA_ICON_VERSION}`

function ensureMeta(name: string, content: string): void {
  const id = `driver-meta-${name}`
  let meta = document.getElementById(id) as HTMLMetaElement | null
  if (!meta) {
    meta = document.createElement('meta')
    meta.id = id
    meta.name = name
    document.head.appendChild(meta)
  }
  meta.content = content
}

function ensureLink(id: string, rel: string, href: string, sizes?: string): void {
  let link = document.getElementById(id) as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.id = id
    document.head.appendChild(link)
  }
  link.rel = rel
  link.href = href
  if (sizes) link.setAttribute('sizes', sizes)
  else link.removeAttribute('sizes')
}

export function installDriverPwaHead(): void {
  if (typeof document === 'undefined') return

  // Drop CRM/root apple-touch + generic icons so Safari cannot pick the wrong one.
  document
    .querySelectorAll('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]')
    .forEach((node) => {
      if (node.id === 'driver-apple-touch-icon') return
      node.parentNode?.removeChild(node)
    })
  document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]').forEach((node) => {
    if (node.id === 'driver-favicon') return
    node.parentNode?.removeChild(node)
  })

  ensureMeta('mobile-web-app-capable', 'yes')
  ensureMeta('apple-mobile-web-app-capable', 'yes')
  ensureMeta('apple-mobile-web-app-status-bar-style', 'default')
  ensureMeta('apple-mobile-web-app-title', 'RS Moto Taxi - Kierowca')
  ensureMeta('application-name', 'RS Moto Taxi - Kierowca')
  ensureMeta('theme-color', '#FFEB3D')

  ensureLink('driver-web-manifest', 'manifest', DRIVER_MANIFEST_HREF)
  ensureLink('driver-apple-touch-icon', 'apple-touch-icon', DRIVER_APPLE_TOUCH_HREF, '180x180')
  ensureLink('driver-favicon', 'icon', DRIVER_FAVICON_HREF, '192x192')
}
