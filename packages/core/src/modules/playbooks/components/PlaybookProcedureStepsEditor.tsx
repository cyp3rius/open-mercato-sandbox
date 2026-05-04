'use client'

import * as React from 'react'
import {
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  GripVertical,
  GitBranch,
  PlayCircle,
  StopCircle,
  Trash2,
  Zap,
} from 'lucide-react'
import { cn } from '@open-mercato/shared/lib/utils'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { IconButton } from '@open-mercato/ui/primitives/icon-button'
import { Separator } from '@open-mercato/ui/primitives/separator'
import { Label } from '@open-mercato/ui/primitives/label'
import {
  CRUD_FORM_SELECT_CLASS,
  CRUD_FORM_TEXT_INPUT_CLASS,
  type CrudCustomFieldRenderProps,
} from '@open-mercato/ui/backend/CrudForm'
import { EntitySearchCombobox } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import { mergeEntitySearchOption, remoteSearchAuthUsers } from '../../procurement/lib/procurementEntitySearch'
import {
  buildProcedureStepTargetLabels,
  createProcedureBlock,
  moveToInsertSlot,
  moveWithinList,
  updateConditionBranch,
  type ProcedureBlock,
} from '../lib/procedureBlocks'
import { PlaybookMarkdownEditor } from './PlaybookMarkdownEditor'
import { usePlaybookFormTabOptional } from './PlaybookFormTabContext'
import type { PlaybookFormTranslator } from './playbookFormConfig'

type ProcedureBlockKind = ProcedureBlock['kind']

function kindIcon(kind: ProcedureBlockKind) {
  switch (kind) {
    case 'start':
      return PlayCircle
    case 'end':
      return StopCircle
    case 'action':
      return Zap
    case 'condition':
      return GitBranch
    case 'goto':
      return CornerDownLeft
  }
}

function KindTag({ kind }: { kind: ProcedureBlockKind }) {
  const t = useT()
  const label =
    kind === 'start'
      ? t('playbooks.procedure.kind.start', 'Start')
      : kind === 'end'
        ? t('playbooks.procedure.kind.end', 'End')
        : kind === 'action'
          ? t('playbooks.procedure.kind.action', 'Action')
          : kind === 'condition'
            ? t('playbooks.procedure.kind.condition', 'Condition')
            : t('playbooks.procedure.kind.goto', 'Go to step')
  const Icon = kindIcon(kind)
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-input bg-muted/40 px-2 py-1 text-xs font-medium text-foreground"
      title={label}
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="max-w-[8rem] truncate sm:max-w-[10rem]">{label}</span>
    </span>
  )
}

type BlockListProps = {
  blocks: ProcedureBlock[]
  onChange: (next: ProcedureBlock[]) => void
  patchBranch: (conditionId: string, side: 'yes' | 'no', next: ProcedureBlock[]) => void
  rootBlocks: ProcedureBlock[]
  targetLabels: Map<string, string>
  disabled: boolean
  depth: number
  listLabel?: string
}

function ProcedureBlockList({
  blocks,
  onChange,
  patchBranch,
  rootBlocks,
  targetLabels,
  disabled,
  depth,
  listLabel,
}: BlockListProps) {
  const t = useT()
  const [draggingIndex, setDraggingIndex] = React.useState<number | null>(null)
  const [insertSlot, setInsertSlot] = React.useState<number | null>(null)
  const [ghostHeightPx, setGhostHeightPx] = React.useState(48)
  const dragFromRef = React.useRef<number | null>(null)
  const insertSlotRef = React.useRef<number | null>(null)

  const resetDragState = React.useCallback(() => {
    dragFromRef.current = null
    insertSlotRef.current = null
    setDraggingIndex(null)
    setInsertSlot(null)
  }, [])

  const addBlock = (kind: ProcedureBlockKind) => {
    onChange([...blocks, createProcedureBlock(kind)])
  }

  const removeAt = (index: number) => {
    onChange(blocks.filter((_, i) => i !== index))
  }

  const move = (index: number, dir: -1 | 1) => {
    const next = index + dir
    if (next < 0 || next >= blocks.length) return
    onChange(moveWithinList(blocks, index, next))
  }

  const isNoopInsert = React.useCallback(
    (from: number, slot: number) => slot === from || slot === from + 1,
    [],
  )

  const updateAt = (index: number, next: ProcedureBlock) => {
    onChange(blocks.map((b, i) => (i === index ? next : b)))
  }

  const updateInsertSlotFromPointer = React.useCallback((e: React.DragEvent) => {
    const container = e.currentTarget as HTMLElement
    const rows = container.querySelectorAll(':scope > [data-procedure-block-row]')
    let slot = rows.length
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i].getBoundingClientRect()
      if (e.clientY < r.top + r.height / 2) {
        slot = i
        break
      }
    }
    insertSlotRef.current = slot
    setInsertSlot(slot)
  }, [])

  const onDragStartBlock = React.useCallback(
    (index: number, e: React.DragEvent) => {
      if (disabled) return
      const card = (e.currentTarget as HTMLElement).closest('[data-procedure-block]')
      if (card instanceof HTMLElement) {
        const h = Math.round(card.getBoundingClientRect().height)
        setGhostHeightPx(Math.max(h, 40))
        const clone = card.cloneNode(true) as HTMLElement
        clone.style.boxSizing = 'border-box'
        clone.style.width = `${card.offsetWidth}px`
        clone.style.opacity = '0.92'
        clone.style.pointerEvents = 'none'
        clone.querySelectorAll('button').forEach((btn) => btn.remove())
        clone.querySelectorAll('input,textarea').forEach((field) => {
          if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
            field.readOnly = true
            field.tabIndex = -1
          }
        })
        clone.querySelectorAll('select').forEach((sel) => {
          sel.setAttribute('disabled', 'true')
        })
        clone.style.position = 'fixed'
        clone.style.left = '-10000px'
        clone.style.top = '0'
        clone.style.zIndex = '9999'
        document.body.appendChild(clone)
        const cardRect = card.getBoundingClientRect()
        const offsetX = Math.min(Math.max(0, e.clientX - cardRect.left), cardRect.width)
        const offsetY = Math.min(Math.max(0, e.clientY - cardRect.top), cardRect.height)
        e.dataTransfer.setDragImage(clone, offsetX, offsetY)
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', `procedure-block:${index}`)
        window.setTimeout(() => clone.remove(), 50)
      } else {
        e.dataTransfer.effectAllowed = 'move'
      }
      dragFromRef.current = index
      setDraggingIndex(index)
      setInsertSlot(null)
      insertSlotRef.current = null
    },
    [disabled],
  )

  const onDragEnd = React.useCallback(() => {
    resetDragState()
  }, [resetDragState])

  const onListDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      if (disabled) return
      const from = dragFromRef.current
      const slot = insertSlotRef.current
      if (from == null || slot == null || from < 0 || from >= blocks.length) {
        resetDragState()
        return
      }
      if (isNoopInsert(from, slot)) {
        resetDragState()
        return
      }
      onChange(moveToInsertSlot(blocks, from, slot))
      resetDragState()
    },
    [blocks, disabled, isNoopInsert, onChange, resetDragState],
  )

  const gotoOptions = React.useMemo(() => {
    const ids = new Set<string>()
    const walk = (arr: ProcedureBlock[]) => {
      for (const b of arr) {
        ids.add(b.id)
        if (b.kind === 'condition') {
          walk(b.yes)
          walk(b.no)
        }
      }
    }
    walk(rootBlocks)
    return Array.from(ids)
  }, [rootBlocks])

  return (
    <div className={cn('space-y-2', depth > 0 && 'border-l-2 border-muted pl-4')}>
      {listLabel ? <div className="text-xs font-medium text-muted-foreground">{listLabel}</div> : null}
      {blocks.length > 0 ? <Separator className="my-3" /> : null}
      <div
        className="space-y-2"
        onDragOver={(e) => {
          if (dragFromRef.current == null) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          updateInsertSlotFromPointer(e)
        }}
        onDrop={onListDrop}
      >
        {blocks.map((block, index) => {
          const showSlotBefore =
            draggingIndex !== null &&
            insertSlot !== null &&
            insertSlot === index &&
            !isNoopInsert(draggingIndex, insertSlot)
          return (
            <div key={block.id} data-procedure-block-row className="space-y-2">
              {showSlotBefore ? (
                <div
                  className="rounded-lg border-2 border-dashed border-primary/50 bg-muted/25"
                  style={{ minHeight: ghostHeightPx }}
                  aria-hidden
                />
              ) : null}
              <div
                className={cn(
                  'rounded-lg border bg-card px-3 py-2',
                  draggingIndex === index && 'opacity-[0.38]',
                )}
                data-procedure-block
              >
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className={cn(
                    'flex h-9 shrink-0 cursor-grab items-center text-muted-foreground',
                    disabled && 'cursor-not-allowed opacity-50',
                  )}
                  draggable={!disabled}
                  onDragStart={(e) => onDragStartBlock(index, e)}
                  onDragEnd={onDragEnd}
                  title={t('playbooks.procedure.dragReorder', 'Drag to reorder')}
                >
                  <GripVertical className="size-4" aria-hidden />
                </div>
                <KindTag kind={block.kind} />
                <input
                  type="text"
                  className={cn(CRUD_FORM_TEXT_INPUT_CLASS, 'min-w-0 flex-1')}
                  value={block.label ?? ''}
                  onChange={(e) => updateAt(index, { ...block, label: e.target.value } as ProcedureBlock)}
                  disabled={disabled}
                  placeholder={t('playbooks.procedure.labelPlaceholder', 'Label')}
                  aria-label={t('playbooks.procedure.stepLabelField', 'Step label')}
                  spellCheck={false}
                />
                <div className="flex shrink-0 items-center gap-0.5">
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={disabled || index === 0}
                    aria-label={t('playbooks.procedure.moveUp', 'Move up')}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp className="size-4" />
                  </IconButton>
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={disabled || index >= blocks.length - 1}
                    aria-label={t('playbooks.procedure.moveDown', 'Move down')}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </IconButton>
                  <IconButton
                    type="button"
                    variant="ghost"
                    size="xs"
                    disabled={disabled}
                    aria-label={t('playbooks.procedure.removeBlock', 'Remove block')}
                    onClick={() => removeAt(index)}
                  >
                    <Trash2 className="size-4" />
                  </IconButton>
                </div>
              </div>

              {block.kind === 'action' ? (
                <div className="space-y-2 pl-0 sm:pl-[calc(0.5rem+4rem+0.5rem)]">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs">{t('playbooks.procedure.actionType', 'Type')}</Label>
                      <select
                        className={cn(CRUD_FORM_SELECT_CLASS, 'w-full')}
                        value={block.actionVariant}
                        onChange={(e) => {
                          const v = e.target.value as 'notify' | 'task' | 'other'
                          if (v === 'task') {
                            updateAt(index, {
                              ...block,
                              actionVariant: 'task',
                              taskTitle: block.taskTitle ?? '',
                              notifyChannel: null,
                              notifyTarget: null,
                              notifyBody: null,
                              otherInstructions: null,
                            })
                          } else if (v === 'other') {
                            updateAt(index, {
                              ...block,
                              actionVariant: 'other',
                              otherInstructions: block.otherInstructions ?? '',
                              notifyChannel: null,
                              notifyTarget: null,
                              notifyBody: null,
                              taskTitle: null,
                            })
                          } else {
                            updateAt(index, {
                              ...block,
                              actionVariant: 'notify',
                              notifyChannel: block.notifyChannel ?? 'email',
                              notifyTarget: block.notifyTarget ?? 'owner',
                              notifyBody: block.notifyBody ?? '',
                              taskTitle: null,
                              otherInstructions: null,
                            })
                          }
                        }}
                        disabled={disabled}
                      >
                        <option value="notify">{t('playbooks.procedure.actionNotify', 'Notification')}</option>
                        <option value="task">{t('playbooks.procedure.actionTask', 'Task')}</option>
                        <option value="other">{t('playbooks.procedure.actionOther', 'Other')}</option>
                      </select>
                    </div>
                    {block.actionVariant === 'notify' ? (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs">{t('playbooks.procedure.notifyChannel', 'Channel')}</Label>
                          <select
                            className={cn(CRUD_FORM_SELECT_CLASS, 'w-full')}
                            value={block.notifyChannel ?? 'email'}
                            onChange={(e) =>
                              updateAt(index, {
                                ...block,
                                notifyChannel: e.target.value as 'email' | 'whatsapp' | 'message',
                              })
                            }
                            disabled={disabled}
                          >
                            <option value="email">{t('playbooks.procedure.channelEmail', 'Email')}</option>
                            <option value="whatsapp">{t('playbooks.procedure.channelWhatsapp', 'WhatsApp')}</option>
                            <option value="message">{t('playbooks.procedure.channelMessage', 'Message')}</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t('playbooks.procedure.notifyTarget', 'Recipient')}</Label>
                          <select
                            className={cn(CRUD_FORM_SELECT_CLASS, 'w-full')}
                            value={block.notifyTarget ?? 'owner'}
                            onChange={(e) =>
                              updateAt(index, {
                                ...block,
                                notifyTarget: e.target.value as 'customer' | 'owner',
                              })
                            }
                            disabled={disabled}
                          >
                            <option value="owner">{t('playbooks.procedure.targetOwner', 'Owner')}</option>
                            <option value="customer">{t('playbooks.procedure.targetCustomer', 'Customer')}</option>
                          </select>
                        </div>
                      </>
                    ) : block.actionVariant === 'task' ? (
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs">{t('playbooks.procedure.taskTitle', 'Task title')}</Label>
                        <input
                          type="text"
                          className={cn(CRUD_FORM_TEXT_INPUT_CLASS, 'w-full')}
                          value={block.taskTitle ?? ''}
                          onChange={(e) => updateAt(index, { ...block, taskTitle: e.target.value })}
                          disabled={disabled}
                          spellCheck={false}
                        />
                      </div>
                    ) : null}
                  </div>
                  {block.actionVariant === 'notify' ? (
                    <div className="space-y-1">
                      <Label className="text-xs">{t('playbooks.procedure.notifyBody', 'Notification body')}</Label>
                      <PlaybookMarkdownEditor
                        value={block.notifyBody ?? ''}
                        onChange={(md) =>
                          updateAt(index, {
                            ...block,
                            notifyBody: md,
                          })
                        }
                        disabled={disabled}
                        height={200}
                      />
                    </div>
                  ) : block.actionVariant === 'other' ? (
                    <div className="space-y-1">
                      <Label className="text-xs">{t('playbooks.procedure.otherInstructions', 'What to do and how')}</Label>
                      <PlaybookMarkdownEditor
                        value={block.otherInstructions ?? ''}
                        onChange={(md) =>
                          updateAt(index, {
                            ...block,
                            otherInstructions: md,
                          })
                        }
                        disabled={disabled}
                        height={200}
                      />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {block.kind === 'goto' ? (
                <div className="space-y-1 pl-0 sm:pl-[calc(0.5rem+4rem+0.5rem)]">
                  <Label className="text-xs">{t('playbooks.procedure.gotoTarget', 'Target step')}</Label>
                  <select
                    className={cn(CRUD_FORM_SELECT_CLASS, 'w-full max-w-xl')}
                    value={block.targetStepId}
                    onChange={(e) => updateAt(index, { ...block, targetStepId: e.target.value })}
                    disabled={disabled}
                  >
                    <option value="">{t('playbooks.procedure.gotoPlaceholder', 'Select step…')}</option>
                    {gotoOptions
                      .filter((id) => id !== block.id)
                      .map((id) => (
                        <option key={id} value={id}>
                          {targetLabels.get(id) ?? id.slice(0, 8)}
                        </option>
                      ))}
                  </select>
                </div>
              ) : null}

              {block.kind === 'condition' ? (
                <div className="space-y-3 pt-1 pl-0 sm:pl-[calc(0.5rem+4rem+0.5rem)]">
                  <div className="space-y-2">
                    <div className="max-w-md space-y-1">
                      <Label className="text-xs">{t('playbooks.procedure.conditionType', 'Condition type')}</Label>
                      <select
                        className={cn(CRUD_FORM_SELECT_CLASS, 'w-full')}
                        value={block.conditionMode ?? 'manual'}
                        onChange={(e) => {
                          const mode = e.target.value as 'manual' | 'verification'
                          updateAt(index, {
                            ...block,
                            conditionMode: mode,
                            verificationUserId: mode === 'manual' ? null : block.verificationUserId ?? '',
                          })
                        }}
                        disabled={disabled}
                      >
                        <option value="manual">{t('playbooks.procedure.conditionManual', 'Manual')}</option>
                        <option value="verification">
                          {t('playbooks.procedure.conditionVerification', 'Verification')}
                        </option>
                      </select>
                    </div>
                    {(block.conditionMode ?? 'manual') === 'manual' ? (
                      <p className="max-w-2xl text-xs leading-snug text-muted-foreground">
                        {t(
                          'playbooks.procedure.conditionManualHint',
                          'The case owner decides Yes or No for this condition on the case.',
                        )}
                      </p>
                    ) : (
                      <div className="max-w-xl space-y-1">
                        <Label className="text-xs">{t('playbooks.procedure.verificationAssignee', 'Verifier')}</Label>
                        <EntitySearchCombobox
                          value={typeof block.verificationUserId === 'string' ? block.verificationUserId : ''}
                          onChange={(next) =>
                            updateAt(index, {
                              ...block,
                              verificationUserId: next.trim().length ? next : null,
                            })
                          }
                          options={mergeEntitySearchOption(
                            [],
                            typeof block.verificationUserId === 'string' ? block.verificationUserId : '',
                            typeof block.verificationUserId === 'string' ? block.verificationUserId : '',
                          )}
                          onRemoteSearch={remoteSearchAuthUsers}
                          placeholder={t(
                            'playbooks.procedure.verificationAssigneePlaceholder',
                            'Choose who verifies…',
                          )}
                          searchPlaceholder={t(
                            'playbooks.procedure.verificationAssigneeSearch',
                            'Search users…',
                          )}
                          disabled={disabled}
                          createInNewTabHref="/backend/users/create"
                          createInNewTabAriaLabel={t(
                            'playbooks.procedure.verificationAssigneeAddUser',
                            'Create user in a new tab',
                          )}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <GitBranch className="size-3.5 shrink-0" aria-hidden />
                    {t('playbooks.procedure.conditionHint', 'Yes / No branches')}
                  </div>
                  <ProcedureBlockList
                    blocks={block.yes}
                    onChange={(next) => patchBranch(block.id, 'yes', next)}
                    patchBranch={patchBranch}
                    rootBlocks={rootBlocks}
                    targetLabels={targetLabels}
                    disabled={disabled}
                    depth={depth + 1}
                    listLabel={t('playbooks.procedure.branchYes', 'Yes')}
                  />
                  <ProcedureBlockList
                    blocks={block.no}
                    onChange={(next) => patchBranch(block.id, 'no', next)}
                    patchBranch={patchBranch}
                    rootBlocks={rootBlocks}
                    targetLabels={targetLabels}
                    disabled={disabled}
                    depth={depth + 1}
                    listLabel={t('playbooks.procedure.branchNo', 'No')}
                  />
                </div>
              ) : null}
            </div>
              </div>
            </div>
          )
        })}
        {draggingIndex !== null &&
        insertSlot !== null &&
        insertSlot === blocks.length &&
        !isNoopInsert(draggingIndex, insertSlot) ? (
          <div
            className="rounded-lg border-2 border-dashed border-primary/50 bg-muted/25"
            style={{ minHeight: ghostHeightPx }}
            aria-hidden
          />
        ) : null}
      </div>
      {blocks.length > 0 ? <Separator className="my-3" /> : null}
      <div className={cn('flex flex-wrap gap-2', blocks.length === 0 && 'pt-1')}>
        {(
          depth > 0
            ? (['action', 'condition', 'goto', 'end'] as const)
            : (['start', 'action', 'condition', 'goto', 'end'] as const)
        ).map((kind) => {
          const Icon =
            kind === 'start'
              ? PlayCircle
              : kind === 'action'
                ? Zap
                : kind === 'condition'
                  ? GitBranch
                  : kind === 'goto'
                    ? CornerDownLeft
                    : StopCircle
          return (
            <Button
              key={kind}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => addBlock(kind)}
              className="h-8"
            >
              <Icon className="mr-1.5 size-3.5" />
              {kind === 'start'
                ? t('playbooks.procedure.addStart', 'Start')
                : kind === 'action'
                  ? t('playbooks.procedure.addAction', 'Action')
                  : kind === 'condition'
                    ? t('playbooks.procedure.addCondition', 'Condition')
                    : kind === 'goto'
                      ? t('playbooks.procedure.addGoto', 'Go to')
                      : t('playbooks.procedure.addEnd', 'End')}
            </Button>
          )
        })}
      </div>
    </div>
  )
}

function ProcedureStepsInner({
  value,
  onChange,
  disabled,
}: {
  value: ProcedureBlock[]
  onChange: (next: ProcedureBlock[]) => void
  disabled: boolean
}) {
  const t = useT()
  const patchBranch = React.useCallback(
    (conditionId: string, side: 'yes' | 'no', next: ProcedureBlock[]) => {
      onChange(updateConditionBranch(value, conditionId, side, next))
    },
    [value, onChange],
  )

  const targetLabels = React.useMemo(
    () =>
      buildProcedureStepTargetLabels(value, (kind) =>
        kind === 'start'
          ? t('playbooks.procedure.targetShort.start', 'Start')
          : kind === 'end'
            ? t('playbooks.procedure.targetShort.end', 'End')
            : kind === 'action'
              ? t('playbooks.procedure.targetShort.action', 'Action')
              : kind === 'condition'
                ? t('playbooks.procedure.targetShort.condition', 'Condition')
                : t('playbooks.procedure.targetShort.goto', 'Jump'),
      ),
    [value, t],
  )

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <h3 className="text-sm font-medium leading-none text-foreground">
          {t('playbooks.form.procedureSchema', 'Procedure flow')}
        </h3>
        <p className="text-xs leading-snug text-muted-foreground">
          {t(
            'playbooks.procedure.lead',
            'Build the flow from top to bottom. Drag blocks or use arrows to reorder within the same list (main flow or Yes/No branches).',
          )}
        </p>
      </div>
      <ProcedureBlockList
        blocks={value}
        onChange={onChange}
        patchBranch={patchBranch}
        rootBlocks={value}
        targetLabels={targetLabels}
        disabled={disabled}
        depth={0}
      />
    </div>
  )
}

export function buildPlaybookProcedureDefinitionField(
  _t: PlaybookFormTranslator,
): (props: CrudCustomFieldRenderProps) => React.ReactNode {
  return function PlaybookProcedureDefinitionField(props: CrudCustomFieldRenderProps) {
    const { value, setValue, disabled, error } = props
    const tabCtx = usePlaybookFormTabOptional()
    const hideSteps = tabCtx == null || tabCtx.activeTab === 'details'
    const blocks = Array.isArray(value) ? (value as ProcedureBlock[]) : []

    const handleChange = React.useCallback(
      (next: ProcedureBlock[]) => {
        setValue(next)
      },
      [setValue],
    )

    return (
      <div className={cn(hideSteps && 'hidden')}>
        <ProcedureStepsInner value={blocks} onChange={handleChange} disabled={Boolean(disabled)} />
        {error ? <div className="mt-2 text-xs text-red-600">{error}</div> : null}
      </div>
    )
  }
}
