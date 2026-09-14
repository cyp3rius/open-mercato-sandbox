/* Driver PWA service worker — scoped to /driver */
const CACHE = 'taxi-fleet-driver-v4'

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Never cache login HTML — stale shells break hydration and dump native POSTs to the API.
  if (url.pathname === '/driver/login' || url.pathname.startsWith('/driver/login/')) {
    event.respondWith(fetch(request))
    return
  }

  if (url.pathname.startsWith('/api/taxi_fleet/driver/')) {
    event.respondWith(
      fetch(request)
        .then((res) => res)
        .catch(() => caches.match(request)),
    )
    return
  }

  if (!url.pathname.startsWith('/driver')) return

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        const network = await fetch(request)
        if (network.ok && (url.pathname === '/driver' || url.pathname.endsWith('.webmanifest'))) {
          cache.put(request, network.clone())
        }
        return network
      } catch {
        const cached = await cache.match(request)
        if (cached) return cached
        return cache.match('/driver') || Response.error()
      }
    }),
  )
})

self.addEventListener('push', (event) => {
  let payload = {
    title: 'RS Moto Taxi',
    body: '',
    url: '/driver/trips',
    tag: 'taxi_fleet:push',
    tripId: null,
    kind: null,
  }
  try {
    if (event.data) {
      const data = event.data.json()
      payload = {
        title: typeof data.title === 'string' && data.title ? data.title : payload.title,
        body: typeof data.body === 'string' ? data.body : '',
        url:
          typeof data.url === 'string' && data.url.startsWith('/driver')
            ? data.url
            : payload.url,
        tag: typeof data.tag === 'string' && data.tag ? data.tag : payload.tag,
        tripId: typeof data.tripId === 'string' ? data.tripId : null,
        kind: typeof data.kind === 'string' ? data.kind : null,
      }
    }
  } catch {
    // Keep defaults — Safari requires a visible notification after push.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      renotify: true,
      icon: '/driver/icon-192.png',
      badge: '/driver/icon-192.png',
      data: {
        url: payload.url,
        tripId: payload.tripId,
        kind: payload.kind,
      },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  const targetPath =
    typeof data.url === 'string' && data.url.startsWith('/driver')
      ? data.url
      : '/driver/trips'
  const targetUrl = new URL(targetPath, self.location.origin).href

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of allClients) {
        if ('focus' in client && client.url.startsWith(self.location.origin + '/driver')) {
          await client.focus()
          if ('navigate' in client && typeof client.navigate === 'function') {
            try {
              await client.navigate(targetUrl)
            } catch {
              // Fall through to openWindow
            }
          }
          return
        }
      }
      if (self.clients.openWindow) {
        await self.clients.openWindow(targetUrl)
      }
    })(),
  )
})
