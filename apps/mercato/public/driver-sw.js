/* Driver PWA service worker — scoped to /driver */
const CACHE = 'taxi-fleet-driver-v2'

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
