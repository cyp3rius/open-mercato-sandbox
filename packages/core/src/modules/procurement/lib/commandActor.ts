import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'

/** Resolves the authenticated user id for timeline and audit fields (JWT may only set `sub`). */
export function resolveProcurementCommandActorUserId(ctx: CommandRuntimeContext): string | null {
  const auth = ctx.auth
  if (!auth) return null
  const fromUserId = typeof auth.userId === 'string' && auth.userId.trim().length ? auth.userId.trim() : null
  if (fromUserId) return fromUserId
  const sub = typeof auth.sub === 'string' && auth.sub.trim().length ? auth.sub.trim() : null
  return sub
}
