/**
 * Driver PWA build id — bump when shipping driver-app UX/runtime changes so
 * installed home-screen clients pick up a new service worker / cache.
 * Kept in sync with `public/driver-sw.js` (`DRIVER_APP_VERSION`) by
 * `scripts/bump-driver-pwa-version.mjs` (husky pre-commit).
 */
export const DRIVER_APP_VERSION = '20260916a'
