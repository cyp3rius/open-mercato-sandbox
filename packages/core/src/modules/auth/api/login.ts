import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { OpenApiMethodDoc, OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { userLoginSchema } from '@open-mercato/core/modules/auth/data/validators'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { AuthService } from '@open-mercato/core/modules/auth/services/authService'
import { RbacService } from '@open-mercato/core/modules/auth/services/rbacService'
import { signJwt } from '@open-mercato/shared/lib/auth/jwt'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import type { EventBus } from '@open-mercato/events/types'
import { parseBooleanToken } from '@open-mercato/shared/lib/boolean'
import { emitAuthEvent } from '@open-mercato/core/modules/auth/events'
import { rateLimitErrorSchema } from '@open-mercato/shared/lib/ratelimit/helpers'
import { readEndpointRateLimitConfig } from '@open-mercato/shared/lib/ratelimit/config'
import { checkAuthRateLimit, resetAuthRateLimit } from '@open-mercato/core/modules/auth/lib/rateLimitCheck'
import { runCustomRouteAfterInterceptors } from '@open-mercato/shared/lib/crud/custom-route-interceptor'
import { toAbsoluteUrl } from '@open-mercato/shared/lib/url'

const loginRateLimitConfig = readEndpointRateLimitConfig('LOGIN', {
  points: 5, duration: 60, blockDuration: 60, keyPrefix: 'login',
})
const loginIpRateLimitConfig = readEndpointRateLimitConfig('LOGIN_IP', {
  points: 20, duration: 60, blockDuration: 60, keyPrefix: 'login-ip',
})

export const metadata = {}

const DEFAULT_LOGIN_REDIRECT = '/backend'

/** Relative same-origin path only; blocks protocol-relative and off-site URLs. */
function sanitizeLoginRedirect(raw: string | null | undefined, fallback = DEFAULT_LOGIN_REDIRECT): string {
  const value = String(raw ?? '').trim()
  if (!value.startsWith('/') || value.startsWith('//')) return fallback
  if (value.includes('\\') || /[\r\n]/.test(value)) return fallback
  try {
    const resolved = new URL(value, 'http://localhost')
    if (resolved.username || resolved.password || resolved.hostname !== 'localhost') return fallback
    return `${resolved.pathname}${resolved.search}${resolved.hash}` || fallback
  } catch {
    return fallback
  }
}

function wantsJsonLoginResponse(req: Request): boolean {
  const accept = (req.headers.get('accept') || '').toLowerCase()
  // Explicit JSON-only clients (e.g. driver/app fetch with Accept: application/json).
  if (accept.includes('application/json') && !accept.includes('text/html')) return true
  if ((req.headers.get('x-mercato-login-response') || '').toLowerCase() === 'json') return true
  return false
}

function applyAuthCookies(
  res: NextResponse,
  authToken: string,
  refreshToken: string | undefined,
  remember: boolean,
) {
  res.cookies.set('auth_token', authToken, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 8,
  })
  if (remember && refreshToken) {
    const days = Number(process.env.REMEMBER_ME_DAYS || '30')
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    res.cookies.set('session_token', refreshToken, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      expires: expiresAt,
    })
  }
}

// validation comes from userLoginSchema

export async function POST(req: Request) {
  const { translate } = await resolveTranslations()
  const form = await req.formData()
  const email = String(form.get('email') ?? '')
  const password = String(form.get('password') ?? '')
  const remember = parseBooleanToken(form.get('remember')?.toString()) === true
  const tenantIdRaw = String(form.get('tenantId') ?? form.get('tenant') ?? '').trim()
  const requireRoleRaw = (String(form.get('requireRole') ?? form.get('role') ?? '')).trim()
  const requiredRoles = requireRoleRaw ? requireRoleRaw.split(',').map((s) => s.trim()).filter(Boolean) : []
  const requireFeatureRaw = (String(form.get('requireFeature') ?? form.get('feature') ?? '')).trim()
  const requiredFeatures = requireFeatureRaw
    ? requireFeatureRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : []
  const redirectTo = sanitizeLoginRedirect(String(form.get('redirect') ?? form.get('next') ?? ''))
  // Rate limit — two layers, both checked before validation and DB work
  const { error: rateLimitError, compoundKey: rateLimitCompoundKey } = await checkAuthRateLimit({
    req, ipConfig: loginIpRateLimitConfig, compoundConfig: loginRateLimitConfig, compoundIdentifier: email,
  })
  if (rateLimitError) return rateLimitError
  const parsed = userLoginSchema.pick({ email: true, password: true, tenantId: true }).safeParse({
    email,
    password,
    tenantId: tenantIdRaw || undefined,
  })
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: translate('auth.login.errors.invalidCredentials', 'Invalid credentials') }, { status: 400 })
  }
  const container = await createRequestContainer()
  const auth = (container.resolve('authService') as AuthService)
  const tenantId = parsed.data.tenantId ?? null
  let user = null
  if (tenantId) {
    user = await auth.findUserByEmailAndTenant(parsed.data.email, tenantId)
  } else {
    const users = await auth.findUsersByEmail(parsed.data.email)
    if (users.length > 1) {
      return NextResponse.json({
        ok: false,
        error: translate('auth.login.errors.tenantRequired', 'Use the login link provided with your tenant activation to continue.'),
      }, { status: 400 })
    }
    user = users[0] ?? null
  }
  if (!user || !user.passwordHash) {
    void emitAuthEvent('auth.login.failed', { email: parsed.data.email, reason: 'invalid_credentials' }).catch(() => undefined)
    return NextResponse.json({ ok: false, error: translate('auth.login.errors.invalidCredentials', 'Invalid email or password') }, { status: 401 })
  }
  const ok = await auth.verifyPassword(user, parsed.data.password)
  if (!ok) {
    void emitAuthEvent('auth.login.failed', { email: parsed.data.email, reason: 'invalid_password' }).catch(() => undefined)
    return NextResponse.json({ ok: false, error: translate('auth.login.errors.invalidCredentials', 'Invalid email or password') }, { status: 401 })
  }
  const resolvedTenantIdForAcl = tenantId ?? (user.tenantId ? String(user.tenantId) : null)
  const organizationIdForAcl = user.organizationId ? String(user.organizationId) : null

  // Optional role requirement (any of the listed roles)
  if (requiredRoles.length) {
    const userRoleNames = await auth.getUserRoles(user, resolvedTenantIdForAcl)
    const authorized = requiredRoles.some((r) => userRoleNames.includes(r))
    if (!authorized) {
      return NextResponse.json({ ok: false, error: translate('auth.login.errors.permissionDenied', 'Not authorized for this area') }, { status: 403 })
    }
  }

  // Optional feature requirement (all listed features; wildcards honored via RBAC)
  if (requiredFeatures.length) {
    const rbac = container.resolve('rbacService') as RbacService
    const authorized = await rbac.userHasAllFeatures(String(user.id), requiredFeatures, {
      tenantId: resolvedTenantIdForAcl,
      organizationId: organizationIdForAcl,
    })
    if (!authorized) {
      return NextResponse.json({ ok: false, error: translate('auth.login.errors.permissionDenied', 'Not authorized for this area') }, { status: 403 })
    }
  }

  await auth.updateLastLoginAt(user)
  // Reset rate limit counter on successful login so legitimate users aren't penalized for prior typos
  if (rateLimitCompoundKey) {
    await resetAuthRateLimit(rateLimitCompoundKey, loginRateLimitConfig)
  }
  const resolvedTenantId = tenantId ?? (user.tenantId ? String(user.tenantId) : null)
  const userRoleNames = await auth.getUserRoles(user, resolvedTenantId)
  try {
    const eventBus = (container.resolve('eventBus') as EventBus)
    void eventBus.emitEvent('query_index.coverage.warmup', {
      tenantId: resolvedTenantId,
    }).catch(() => undefined)
  } catch {
    // optional warmup
  }
  const token = signJwt({
    sub: String(user.id),
    tenantId: resolvedTenantId,
    orgId: user.organizationId ? String(user.organizationId) : null,
    email: user.email,
    roles: userRoleNames
  })
  void emitAuthEvent('auth.login.success', { id: String(user.id), email: user.email, tenantId: resolvedTenantId, organizationId: user.organizationId ? String(user.organizationId) : null }).catch(() => undefined)
  const responseData: { ok: true; token: string; redirect: string; refreshToken?: string } = {
    ok: true,
    token,
    redirect: redirectTo,
  }
  if (remember) {
    const days = Number(process.env.REMEMBER_ME_DAYS || '30')
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)
    const sess = await auth.createSession(user, expiresAt)
    responseData.refreshToken = sess.token
  }
  const em = container.resolve('em')
  const interceptedResponse = await runCustomRouteAfterInterceptors({
    routePath: 'auth/login',
    method: 'POST',
    request: {
      method: 'POST',
      url: req.url,
      body: {
        email: parsed.data.email,
        tenantId: parsed.data.tenantId ?? undefined,
        remember,
        requireRole: requiredRoles.length > 0 ? requiredRoles : undefined,
        requireFeature: requiredFeatures.length > 0 ? requiredFeatures : undefined,
        redirect: redirectTo,
      },
      headers: Object.fromEntries(req.headers.entries()),
    },
    response: {
      statusCode: 200,
      body: responseData,
      headers: {},
    },
    context: {
      em,
      container,
    },
  })
  if (!interceptedResponse.ok) {
    return NextResponse.json(interceptedResponse.body, { status: interceptedResponse.statusCode })
  }

  const interceptedBody = interceptedResponse.body as Record<string, unknown>
  const authTokenForCookie = typeof interceptedBody.token === 'string' && interceptedBody.token.length > 0
    ? interceptedBody.token
    : token
  const refreshTokenForCookie = typeof interceptedBody.refreshToken === 'string'
    ? interceptedBody.refreshToken
    : undefined
  const finalRedirect =
    typeof interceptedBody.redirect === 'string' && interceptedBody.redirect.length > 0
      ? sanitizeLoginRedirect(interceptedBody.redirect, redirectTo)
      : redirectTo
  const responseBody =
    typeof interceptedBody.redirect === 'string'
      ? { ...interceptedBody, redirect: finalRedirect }
      : interceptedBody

  // Default: HTTP redirect for browser <form> posts. JSON only when the client asks for it.
  if (!wantsJsonLoginResponse(req) && interceptedBody.mfa_required !== true) {
    const res = NextResponse.redirect(toAbsoluteUrl(req, finalRedirect), 303)
    applyAuthCookies(res, authTokenForCookie, refreshTokenForCookie, remember)
    return res
  }

  const res = NextResponse.json(responseBody, { status: interceptedResponse.statusCode })
  applyAuthCookies(res, authTokenForCookie, refreshTokenForCookie, remember)
  return res
}

const loginRequestSchema = userLoginSchema.extend({
  password: z.string().min(6).describe('User password'),
  remember: z.enum(['on', '1', 'true']).optional().describe('Persist the session (submit `on`, `1`, or `true`).'),
  redirect: z.string().optional().describe('Relative path to open after login (default /backend).'),
}).describe('Login form payload')

const loginSuccessSchema = z.object({
  ok: z.literal(true),
  token: z.string().describe('JWT token issued for subsequent API calls'),
  redirect: z.string().nullable().describe('Next location the client should navigate to'),
  refreshToken: z.string().optional().describe('Long-lived refresh token for obtaining new access tokens (only present when remember=true)'),
})

const loginErrorSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
})

const loginMethodDoc: OpenApiMethodDoc = {
  summary: 'Authenticate user credentials',
  description: 'Validates the submitted credentials and issues a bearer token cookie for subsequent API calls.',
  tags: ['Authentication & Accounts'],
  requestBody: {
    contentType: 'application/x-www-form-urlencoded',
    schema: loginRequestSchema,
    description: 'Form-encoded payload captured from the login form.',
  },
  responses: [
    {
      status: 200,
      description: 'Authentication succeeded',
      schema: loginSuccessSchema,
    },
  ],
  errors: [
    { status: 400, description: 'Validation failed', schema: loginErrorSchema },
    { status: 401, description: 'Invalid credentials', schema: loginErrorSchema },
    { status: 403, description: 'User lacks required role or feature', schema: loginErrorSchema },
    { status: 429, description: 'Too many login attempts', schema: rateLimitErrorSchema },
  ],
}

export const openApi: OpenApiRouteDoc = {
  summary: 'Authenticate user credentials',
  description: 'Accepts login form submissions and manages cookie/session issuance.',
  methods: {
    POST: loginMethodDoc,
  },
}
