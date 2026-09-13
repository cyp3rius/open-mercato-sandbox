import type { NextResponse } from 'next/server'
import { hasFeature } from '@open-mercato/shared/security/features'
import type { FleetActorScopeCtx } from './backendFleetActor'

export const DRIVER_IMPERSONATE_COOKIE = 'om_tf_driver_impersonate'
export const DRIVER_IMPERSONATE_FEATURE = 'taxi_fleet.driver.impersonate'
export const DRIVER_IMPERSONATE_MAX_AGE_SEC = 60 * 60 * 8

export type DriverImpersonationInfo = {
  active: true
  teamMemberId: string
  displayName: string
  profileId: string | null
  readOnly: true
}

function readCookieFromHeader(cookieHeader: string, name: string): string | null {
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  if (!match?.[1]) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

export function readDriverImpersonationTeamMemberId(req: Request | null | undefined): string | null {
  if (!req) return null
  const raw = readCookieFromHeader(req.headers.get('cookie') || '', DRIVER_IMPERSONATE_COOKIE)
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed.length ? trimmed : null
}

export function applyDriverImpersonationCookie(
  res: NextResponse,
  teamMemberId: string,
): void {
  res.cookies.set(DRIVER_IMPERSONATE_COOKIE, teamMemberId, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: DRIVER_IMPERSONATE_MAX_AGE_SEC,
  })
}

export function clearDriverImpersonationCookie(res: NextResponse): void {
  res.cookies.set(DRIVER_IMPERSONATE_COOKIE, '', {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 0,
  })
}

async function loadUserFeatures(ctx: FleetActorScopeCtx): Promise<string[]> {
  const userId = ctx.auth?.sub
  const tenantId =
    ctx.auth?.tenantId ?? ctx.organizationScope?.tenantId ?? null
  if (!userId || !tenantId) return []
  const rbac = ctx.container.resolve('rbacService') as {
    loadAcl: (
      userId: string,
      scope: { tenantId: string | null; organizationId: string | null },
    ) => Promise<{ isSuperAdmin: boolean; features: string[] }>
  }
  const organizationId =
    ctx.selectedOrganizationId ?? ctx.organizationScope?.selectedId ?? ctx.auth?.orgId ?? null
  const acl = await rbac.loadAcl(userId, { tenantId, organizationId })
  if (acl.isSuperAdmin) return ['*']
  return Array.isArray(acl.features) ? acl.features : []
}

export async function actorCanImpersonateDriver(ctx: FleetActorScopeCtx): Promise<boolean> {
  const features = await loadUserFeatures(ctx)
  return hasFeature(features, DRIVER_IMPERSONATE_FEATURE)
}
