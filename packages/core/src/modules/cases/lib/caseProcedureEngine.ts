import type { ProcedureBlock } from '../../playbooks/lib/procedureBlocks'

export type LocatedBlock = {
  block: ProcedureBlock
  parentList: ProcedureBlock[]
  index: number
}

export function findWithPath(root: ProcedureBlock[], id: string): LocatedBlock | null {
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

/** Next block in preorder execution after `currentId`, or null if procedure finished / invalid. */
export function nextGlobal(root: ProcedureBlock[], currentId: string): string | null {
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

export function firstExecutableBlockId(root: ProcedureBlock[]): string | null {
  if (!root.length) return null
  const head = root[0]
  if (head.kind === 'start') return nextGlobal(root, head.id)
  return head.id
}

export function firstInList(list: ProcedureBlock[]): string | null {
  if (!list.length) return null
  return list[0].id
}

export function describeBlock(block: ProcedureBlock): { title: string; detail: string } {
  const label = typeof block.label === 'string' && block.label.trim().length ? block.label.trim() : null
  switch (block.kind) {
    case 'start':
      return { title: label ?? 'Start', detail: '' }
    case 'end':
      return { title: label ?? 'End', detail: '' }
    case 'action': {
      const v = block.actionVariant
      let detail = ''
      if (v === 'notify') {
        detail = [block.notifyChannel, block.notifyTarget].filter(Boolean).join(' · ')
        if (block.notifyBody?.trim()) detail = `${detail}\n${block.notifyBody.trim()}`
      } else if (v === 'task') {
        detail = block.taskTitle?.trim() ?? ''
      } else {
        detail = block.otherInstructions?.trim() ?? ''
      }
      return { title: label ?? 'Action', detail }
    }
    case 'condition': {
      const mode = block.conditionMode === 'verification' ? 'verification' : 'manual'
      return {
        title: label ?? 'Condition',
        detail: mode,
      }
    }
    case 'goto':
      return { title: label ?? 'Goto', detail: block.targetStepId ?? '' }
    default:
      return { title: label ?? '—', detail: '' }
  }
}
