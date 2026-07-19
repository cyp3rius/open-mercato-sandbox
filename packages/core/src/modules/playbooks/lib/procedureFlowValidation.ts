import type { ProcedureBlock } from './procedureBlocks'

function collectProcedureBlockIds(blocks: ProcedureBlock[]): string[] {
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim())
}

type LocatedBlock = {
  block: ProcedureBlock
  parentList: ProcedureBlock[]
  index: number
}

function findWithPath(root: ProcedureBlock[], id: string): LocatedBlock | null {
  const walk = (blocks: ProcedureBlock[]): LocatedBlock | null => {
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]
      if (b.id === id) return { block: b, parentList: blocks, index: i }
      if (b.kind === 'condition') {
        const y = walk(b.yes)
        if (y) return y
        const n = walk(b.no)
        if (n) return n
      }
    }
    return null
  }
  return walk(root)
}

function findConditionOwningSublist(root: ProcedureBlock[], sublist: ProcedureBlock[]): ProcedureBlock | null {
  for (const b of root) {
    if (b.kind === 'condition') {
      if (b.yes === sublist || b.no === sublist) return b
      const y = findConditionOwningSublist(b.yes, sublist)
      if (y) return y
      const n = findConditionOwningSublist(b.no, sublist)
      if (n) return n
    }
  }
  return null
}

function nextGlobal(root: ProcedureBlock[], currentId: string): string | null {
  const loc = findWithPath(root, currentId)
  if (!loc) return null
  let { parentList, index } = loc
  while (true) {
    if (index + 1 < parentList.length) return parentList[index + 1].id
    const owning = findConditionOwningSublist(root, parentList)
    if (!owning) return null
    const outer = findWithPath(root, owning.id)
    if (!outer) return null
    parentList = outer.parentList
    index = outer.index
  }
}

function firstInList(list: ProcedureBlock[]): string | null {
  if (!list.length) return null
  return list[0].id
}

function firstExecutableBlockId(root: ProcedureBlock[]): string | null {
  if (!root.length) return null
  const head = root[0]
  if (head.kind === 'start') return nextGlobal(root, head.id)
  return head.id
}

function isFlowTerminal(block: ProcedureBlock): boolean {
  return block.kind === 'end' || block.kind === 'invoke_procedure'
}

function outgoingStepIds(root: ProcedureBlock[], blockId: string, idSet: Set<string>): string[] {
  const loc = findWithPath(root, blockId)
  if (!loc) return []
  const b = loc.block
  if (isFlowTerminal(b)) return []
  if (b.kind === 'goto') {
    const tid = typeof b.targetStepId === 'string' ? b.targetStepId.trim() : ''
    if (!tid.length || !isUuid(tid) || !idSet.has(tid)) return []
    return [tid]
  }
  if (b.kind === 'condition') {
    const mergeId = nextGlobal(root, blockId)
    const outs: string[] = []
    const y = firstInList(b.yes)
    const n = firstInList(b.no)
    if (y) outs.push(y)
    else if (mergeId) outs.push(mergeId)
    if (n) outs.push(n)
    else if (mergeId && !outs.includes(mergeId)) outs.push(mergeId)
    return [...new Set(outs)]
  }
  const nx = nextGlobal(root, blockId)
  return nx ? [nx] : []
}

function validateAllGotos(blocks: ProcedureBlock[], idSet: Set<string>): { ok: true } | { ok: false; code: string } {
  for (const id of idSet) {
    const loc = findWithPath(blocks, id)
    if (loc?.block.kind !== 'goto') continue
    const tid = typeof loc.block.targetStepId === 'string' ? loc.block.targetStepId.trim() : ''
    if (!tid.length || !isUuid(tid) || !idSet.has(tid)) {
      return { ok: false, code: 'playbooks.procedure.validation.gotoInvalidTarget' }
    }
  }
  return { ok: true }
}

function validateTerminalClosesList(arr: ProcedureBlock[]): { ok: true } | { ok: false; code: string } {
  for (let i = 0; i < arr.length; i++) {
    const b = arr[i]
    if (b.kind === 'condition') {
      const y = validateTerminalClosesList(b.yes)
      if (!y.ok) return y
      const n = validateTerminalClosesList(b.no)
      if (!n.ok) return n
    }
    if ((b.kind === 'end' || b.kind === 'invoke_procedure') && i !== arr.length - 1) {
      return { ok: false, code: 'playbooks.procedure.validation.terminalNotLastInList' }
    }
  }
  return { ok: true }
}

function collectReachableStepIds(
  blocks: ProcedureBlock[],
  entryId: string,
  idSet: Set<string>,
): Set<string> {
  const reachable = new Set<string>()
  const queue = [entryId]
  while (queue.length > 0) {
    const stepId = queue.shift()
    if (!stepId || reachable.has(stepId) || !idSet.has(stepId)) continue
    reachable.add(stepId)
    const loc = findWithPath(blocks, stepId)
    if (!loc || isFlowTerminal(loc.block)) continue
    for (const nextId of outgoingStepIds(blocks, stepId, idSet)) {
      if (!reachable.has(nextId)) queue.push(nextId)
    }
  }
  return reachable
}

function buildReverseAdjacency(
  blocks: ProcedureBlock[],
  idSet: Set<string>,
): Map<string, string[]> {
  const reverse = new Map<string, string[]>()
  for (const stepId of idSet) {
    for (const nextId of outgoingStepIds(blocks, stepId, idSet)) {
      const preds = reverse.get(nextId)
      if (preds) preds.push(stepId)
      else reverse.set(nextId, [stepId])
    }
  }
  return reverse
}

/** Nodes that have a (possibly cyclic) path to `end` or `invoke_procedure`. */
function nodesThatCanReachTerminal(blocks: ProcedureBlock[], idSet: Set<string>): Set<string> {
  const able = new Set<string>()
  const queue: string[] = []
  for (const stepId of idSet) {
    const loc = findWithPath(blocks, stepId)
    if (loc && isFlowTerminal(loc.block)) {
      able.add(stepId)
      queue.push(stepId)
    }
  }
  const reverse = buildReverseAdjacency(blocks, idSet)
  while (queue.length > 0) {
    const cur = queue.shift()
    if (!cur) continue
    for (const pred of reverse.get(cur) ?? []) {
      if (able.has(pred)) continue
      able.add(pred)
      queue.push(pred)
    }
  }
  return able
}

/**
 * Every Start-reachable step must be able to reach `end` or `invoke_procedure`.
 * Cycles (e.g. goto back) are allowed when an exit path exists.
 */
function validateTerminalReachability(
  blocks: ProcedureBlock[],
  entryId: string,
  idSet: Set<string>,
): { ok: true } | { ok: false; code: string } {
  const reachable = collectReachableStepIds(blocks, entryId, idSet)
  if (reachable.size === 0) {
    return { ok: false, code: 'playbooks.procedure.validation.flowDoesNotTerminate' }
  }
  const canExit = nodesThatCanReachTerminal(blocks, idSet)
  for (const stepId of reachable) {
    if (!canExit.has(stepId)) {
      return { ok: false, code: 'playbooks.procedure.validation.flowDoesNotTerminate' }
    }
  }
  return { ok: true }
}

/**
 * Non-empty procedures must begin with Start; every Start-reachable step must be able to reach
 * `end` or `invoke_procedure`. Cycles are allowed when an exit exists. Empty definition is valid.
 */
export function validateProcedureExecutionFlow(
  blocks: ProcedureBlock[],
): { ok: true } | { ok: false; code: string } {
  if (blocks.length === 0) return { ok: true }
  if (blocks[0].kind !== 'start') {
    return { ok: false, code: 'playbooks.procedure.validation.mustStartWithStart' }
  }

  const listClosure = validateTerminalClosesList(blocks)
  if (!listClosure.ok) return listClosure

  const idSet = new Set(collectProcedureBlockIds(blocks))
  const gotoOk = validateAllGotos(blocks, idSet)
  if (!gotoOk.ok) return gotoOk

  const entry = firstExecutableBlockId(blocks)
  if (!entry) {
    return { ok: false, code: 'playbooks.procedure.validation.noStepsAfterStart' }
  }

  return validateTerminalReachability(blocks, entry, idSet)
}
