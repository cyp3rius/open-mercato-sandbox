import { z } from 'zod'
import { procedureDurationSchema, type ProcedureDuration } from './duration'
import { validateProcedureExecutionFlow } from './procedureFlowValidation'

export type ProcedureActionVariant = 'notify' | 'task' | 'other'
export type ProcedureConditionMode = 'manual' | 'verification'
/** Notify delivery channel. Legacy `whatsapp` is normalized to `message` on parse. */
export type ProcedureNotifyChannel = 'email' | 'message' | 'in_app'
export type ProcedureNotifyTarget = 'customer' | 'owner'

export const PROCEDURE_ENTITY_KINDS = [
  'customer',
  'resource',
  'sales_order',
  'sales_quote',
  'sales_deal',
  'insurance_policy',
] as const

export type ProcedureEntityKind = (typeof PROCEDURE_ENTITY_KINDS)[number]

/** Optional kebab-case id from Markdown authoring; ignored by runtime flow. */
type ProcedureBlockSourceMeta = {
  sourceStepId?: string | null
}

export type ProcedureBlock =
  | ({ id: string; kind: 'start'; label?: string | null } & ProcedureBlockSourceMeta)
  | ({ id: string; kind: 'end'; label?: string | null } & ProcedureBlockSourceMeta)
  | ({
      id: string
      kind: 'action'
      label?: string | null
      actionVariant: ProcedureActionVariant
      actionCode?: string | null
      notifyChannel?: ProcedureNotifyChannel | null
      notifyTarget?: ProcedureNotifyTarget | null
      notifyBody?: string | null
      taskTitle?: string | null
      otherInstructions?: string | null
    } & ProcedureBlockSourceMeta)
  | ({
      id: string
      kind: 'condition'
      label?: string | null
      conditionMode?: ProcedureConditionMode | null
      verificationUserId?: string | null
      yes: ProcedureBlock[]
      no: ProcedureBlock[]
    } & ProcedureBlockSourceMeta)
  | ({ id: string; kind: 'goto'; label?: string | null; targetStepId: string } & ProcedureBlockSourceMeta)
  /** References other playbooks by slug; runtime resolves latest active version per slug. */
  | ({
      id: string
      kind: 'invoke_procedure'
      label?: string | null
      playbookSlugs: string[]
      slaDuration?: ProcedureDuration | null
    } & ProcedureBlockSourceMeta)
  | ({
      id: string
      kind: 'select_entity'
      label?: string | null
      entityKind: ProcedureEntityKind
      required?: boolean
      allowCreate?: boolean
    } & ProcedureBlockSourceMeta)

const sourceStepIdField = z.string().trim().min(1).max(120).nullish()


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
        actionVariant: 'other',
        actionCode: 'other',
        notifyChannel: null,
        notifyTarget: null,
        notifyBody: null,
        taskTitle: null,
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
    case 'invoke_procedure':
      return { id, kind: 'invoke_procedure', label: '', playbookSlugs: [], slaDuration: null }
    case 'select_entity':
      return {
        id,
        kind: 'select_entity',
        label: '',
        entityKind: 'customer',
        required: true,
        allowCreate: true,
      }
  }
}

const procedureBlockSchema: z.ZodType<ProcedureBlock> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({
      id: z.string().uuid(),
      kind: z.literal('start'),
      label: z.string().max(400).nullish(),
      sourceStepId: sourceStepIdField,
    }),
    z.object({
      id: z.string().uuid(),
      kind: z.literal('end'),
      label: z.string().max(400).nullish(),
      sourceStepId: sourceStepIdField,
    }),
    z.object({
      id: z.string().uuid(),
      kind: z.literal('action'),
      label: z.string().max(400).nullish(),
      actionVariant: z.enum(['notify', 'task', 'other']),
      actionCode: z.string().min(1).max(160).nullish(),
      notifyChannel: z.preprocess(
        (value) => (value === 'whatsapp' ? 'message' : value),
        z.enum(['email', 'message', 'in_app']).nullish(),
      ),
      notifyTarget: z.enum(['customer', 'owner']).nullish(),
      notifyBody: z.string().max(100000).nullish(),
      taskTitle: z.string().max(500).nullish(),
      otherInstructions: z.string().max(100000).nullish(),
      sourceStepId: sourceStepIdField,
    }),
    z.object({
      id: z.string().uuid(),
      kind: z.literal('condition'),
      label: z.string().max(400).nullish(),
      conditionMode: z.enum(['manual', 'verification']).optional(),
      verificationUserId: z.union([z.string().uuid(), z.literal('')]).nullish(),
      yes: z.array(procedureBlockSchema),
      no: z.array(procedureBlockSchema),
      sourceStepId: sourceStepIdField,
    }),
    z.object({
      id: z.string().uuid(),
      kind: z.literal('goto'),
      label: z.string().max(400).nullish(),
      targetStepId: z.union([z.string().uuid(), z.literal('')]),
      sourceStepId: sourceStepIdField,
    }),
    z.object({
      id: z.string().uuid(),
      kind: z.literal('invoke_procedure'),
      label: z.string().max(400).nullish(),
      playbookSlugs: z.array(z.string().min(1).max(160)).max(20),
      slaDuration: procedureDurationSchema.nullish(),
      sourceStepId: sourceStepIdField,
    }),
    z.object({
      id: z.string().uuid(),
      kind: z.literal('select_entity'),
      label: z.string().max(400).nullish(),
      entityKind: z.enum(PROCEDURE_ENTITY_KINDS),
      required: z.boolean().optional(),
      allowCreate: z.boolean().optional(),
      sourceStepId: sourceStepIdField,
    }),
  ]),
)

export const procedureBlocksArraySchema = z.array(procedureBlockSchema).superRefine((blocks, ctx) => {
  const typed = blocks as ProcedureBlock[]
  const walk = (arr: ProcedureBlock[], pathPrefix: (string | number)[]): void => {
    arr.forEach((block, index) => {
      const path = [...pathPrefix, index]
      if (block.kind === 'invoke_procedure' && block.playbookSlugs.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'invoke_procedure.playbookSlugsMin',
          path: [...path, 'playbookSlugs'],
        })
      }
      if (block.kind === 'condition') {
        walk(block.yes, [...path, 'yes'])
        walk(block.no, [...path, 'no'])
      }
    })
  }
  walk(typed, [])
  if (typed.length > 0 && typed[0].kind !== 'start') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'playbooks.procedure.validation.mustStartWithStart',
      path: [0],
    })
  }
  if (typed.length > 0 && typed[0].kind === 'start') {
    const flow = validateProcedureExecutionFlow(typed)
    if (!flow.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: flow.code,
        path: [],
      })
    }
  }
})

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

function normalizeProcedureInvokeSlugs(blocks: ProcedureBlock[]): ProcedureBlock[] {
  return blocks.map((b) => {
    if (b.kind === 'invoke_procedure') {
      const slugs = Array.from(
        new Set((b.playbookSlugs ?? []).map((s) => String(s).trim().toLowerCase()).filter(Boolean)),
      )
      return { ...b, playbookSlugs: slugs }
    }
    if (b.kind === 'condition') {
      return {
        ...b,
        yes: normalizeProcedureInvokeSlugs(b.yes),
        no: normalizeProcedureInvokeSlugs(b.no),
      }
    }
    if (b.kind === 'action') {
      const code =
        typeof b.actionCode === 'string' && b.actionCode.trim().length
          ? b.actionCode.trim()
          : b.actionVariant
      return { ...b, actionCode: code }
    }
    return b
  })
}

function normalizeProcedureBlocks(raw: unknown): ProcedureBlock[] {
  const res = procedureBlocksArraySchema.safeParse(raw)
  return res.success ? normalizeProcedureInvokeSlugs(res.data) : []
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
