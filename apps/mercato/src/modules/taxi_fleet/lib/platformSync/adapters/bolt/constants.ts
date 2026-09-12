/** Bolt Fleet Integration Gateway — OIDC + API (docs: apidocs.bolt.eu/fleetIntegration). */

export const BOLT_OIDC_TOKEN_URL = 'https://oidc.bolt.eu/token'
export const BOLT_OAUTH_SCOPE = 'fleet-integration:api'
export const BOLT_DEFAULT_API_BASE_URL = 'https://node.bolt.eu/fleet-integration-gateway'

export const BOLT_PATH_GET_COMPANIES = '/fleetIntegration/v1/getCompanies'
export const BOLT_PATH_TEST = '/fleetIntegration/v1/test'
export const BOLT_PATH_GET_FLEET_ORDERS = '/fleetIntegration/v1/getFleetOrders'

/** Refresh token this many ms before `expires_in` elapses. */
export const BOLT_TOKEN_REFRESH_SKEW_MS = 60_000
