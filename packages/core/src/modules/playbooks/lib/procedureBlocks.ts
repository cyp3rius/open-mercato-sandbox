import { z } from 'zod'

export type ProcedureActionVariant = 'notify' | 'task' | 'other'
export type ProcedureConditionMode = 'manual' | 'verification'
export type ProcedureNotifyChannel = 'email' | 'whatsapp' | 'message'
export type ProcedureNotifyTarget = 'customer' | 'owner'

export type ProcedureBlock =
  | { id: string; kind: 'start'; label?: string | null }
  | { id: string; kind: 'end'; label?: string | null }
  | {
      id: string
      kind: 'action'
      label?: string | null
      actionVariant: ProcedureActionVariant
      notifyChannel?: ProcedureNotifyChannel | null
      notifyTarget?: ProcedureNotifyTarget | null
      notifyBody?: string | null
      taskTitle?: string | null
      otherInstructions?: string | null
    }
  | {
      id: string
      kind: 'condition'
      label?: string | null
      conditionMode?: ProcedureConditionMode | null
      verificationUserId?: string | null
      yes: ProcedureBlock[]
      no: ProcedureBlock[]
    }
  | { id: string; kind: 'goto'; label?: string | null; targetStepId: string }

export function newProcedureBlockId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

export function createProcedureBlock(
  kind: ProcedureBlock['kind'],
): ProcedureBlock {
  const id = newProcedureBlockId()
  switch (kind) {
    case 'start':
      return { id, kind: 'start', label: '' }
    case 'end':
      return { id, kind: 'end', label: '' }
    case 'action':
      return {
        id,
        kind: 'action',
        label: '',
        actionVariant: 'notify',
        notifyChannel: 'email',
        notifyTarget: 'owner',
        notifyBody: '',
        taskTitle: '',
        otherInstructions: '',
      }
    case 'condition':
      return {
        id,
        kind: 'condition',
        label: '',
        conditionMode: 'manual',
        verificationUserId: null,
        yes: [],
        no: [],
      }
    case 'goto':
      return { id, kind: 'goto', label: '', targetStepId: '' }
  }
}

const procedureBlockSchema: z.ZodType<ProcedureBlock> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({
      id: z.string().uuid(),
      kind: z.literal('start'),
      label: z.string().max(400).nullish(),
    }),
    z.object({
      id: z.string().uuid(),
      kind: z.literal('end'),
      label: z.string().max(400).nullish(),
    }),
    z.object({
      id: z.string().uuid(),
      kind: z.literal('action'),
      label: z.string().max(400).nullish(),
      actionVariant: z.enum(['notify', 'task', 'other']),
      notifyChannel: z.enum(['email', 'whatsapp', 'message']).nullish(),
      notifyTarget: z.enum(['customer', 'owner']).nullish(),
      notifyBody: z.string().max(100000).nullish(),
      taskTitle: z.string().max(500).nullish(),
      otherInstructions: z.string().max(100000).nullish(),
    }),
    z.object({
      id: z.string().uuid(),
      kind: z.literal('condition'),
      label: z.string().max(400).nullish(),
      conditionMode: z.enum(['manual', 'verification']).optional(),
      verificationUserId: z.union([z.string().uuid(), z.literal('')]).nullish(),
      yes: z.array(procedureBlockSchema),
      no: z.array(procedureBlockSchema),
    }),
    z.object({
      id: z.string().uuid(),
      kind: z.literal('goto'),
      label: z.string().max(400).nullish(),
      targetStepId: z.union([z.string().uuid(), z.literal('')]),
    }),
  ]),
)

export const procedureBlocksArraySchema = z.array(procedureBlockSchema)

export function parseProcedureBlocksJson(raw: unknown): ProcedureBlock[] {
  if (raw == null) return []
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown
      return normalizeProcedureBlocks(parsed)
    } catch {
      return []
    }
  }
  return normalizeProcedureBlocks(raw)
}

function normalizeProcedureBlocks(raw: unknown): ProcedureBlock[] {
  const res = procedureBlocksArraySchema.safeParse(raw)
  return res.success ? res.data : []
}

/** DFS preorder: root lists then recursively yes branch then no branch for each condition. */
export function flattenProcedureBlocksDFS(blocks: ProcedureBlock[]): ProcedureBlock[] {
  const out: ProcedureBlock[] = []
  const walk = (arr: ProcedureBlock[]) => {
    for (const b of arr) {
      out.push(b)
      if (b.kind === 'condition') {
        walk(b.yes)
        walk(b.no)
      }
    }
  }
  walk(blocks)
  return out
}

/**
 * Human-readable target labels for goto dropdowns: custom label, else «Kind» or «Kind #n»
 * when multiple blocks of that kind exist in the procedure tree.
 */
export function buildProcedureStepTargetLabels(
  root: ProcedureBlock[],
  kindShortName: (kind: ProcedureBlock['kind']) => string,
): Map<string, string> {
  const flat = flattenProcedureBlocksDFS(root)
  const totals = new Map<ProcedureBlock['kind'], number>()
  for (const b of flat) {
    totals.set(b.kind, (totals.get(b.kind) ?? 0) + 1)
  }
  const ordinal = new Map<ProcedureBlock['kind'], number>()
  const out = new Map<string, string>()
  for (const b of flat) {
    const idx = (ordinal.get(b.kind) ?? 0) + 1
    ordinal.set(b.kind, idx)
    const custom = typeof b.label === 'string' ? b.label.trim() : ''
    if (custom.length) {
      out.set(b.id, custom)
      continue
    }
    const totalOfKind = totals.get(b.kind) ?? 1
    const base = kindShortName(b.kind)
    out.set(b.id, totalOfKind <= 1 ? base : `${base} #${idx}`)
  }
  return out
}

export function collectProcedureBlockIds(blocks: ProcedureBlock[]): string[] {
  const out: string[] = []
  const walk = (arr: ProcedureBlock[]) => {
    for (const b of arr) {
      out.push(b.id)
      if (b.kind === 'condition') {
        walk(b.yes)
        walk(b.no)
      }
    }
  }
  walk(blocks)
  return out
}

export function updateConditionBranch(
  blocks: ProcedureBlock[],
  conditionId: string,
  side: 'yes' | 'no',
  next: ProcedureBlock[],
): ProcedureBlock[] {
  return blocks.map((b) => {
    if (b.id === conditionId && b.kind === 'condition') {
      return side === 'yes' ? { ...b, yes: next } : { ...b, no: next }
    }
    if (b.kind === 'condition') {
      return {
        ...b,
        yes: updateConditionBranch(b.yes, conditionId, side, next),
        no: updateConditionBranch(b.no, conditionId, side, next),
      }
    }
    return b
  })
}

export function moveWithinList<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items
  }
  const next = [...items]
  const [removed] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, removed)
  return next
}

/**
 * Reorders within one list using a slot index `insertSlot` in 0..length (inclusive):
 * 0 = before first item, length = after last. Matches drag-over “boundary” UI.
 */
export function moveToInsertSlot<T>(items: T[], fromIndex: number, insertSlot: number): T[] {
  const n = items.length
  if (fromIndex < 0 || fromIndex >= n || insertSlot < 0 || insertSlot > n) {
    return items
  }
  if (insertSlot === fromIndex || insertSlot === fromIndex + 1) {
    return items
  }
  const next = [...items]
  const [removed] = next.splice(fromIndex, 1)
  let at = insertSlot
  if (fromIndex < insertSlot) {
    at = insertSlot - 1
  }
  next.splice(at, 0, removed)
  return next
}
