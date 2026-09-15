'use client'

import * as React from 'react'
import { formatProcedurePlaybookLabel } from '../lib/formatProcedurePlaybookLabel'

type Translate = (key: string, fallback?: string) => string

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value)
  return null
}

function procedureKindLabel(kind: string | null, t: Translate): string {
  if (!kind) return ''
  return t(`playbooks.procedure.kind.${kind}`, kind)
}

function entityKindLabel(kind: string | null, t: Translate): string {
  if (!kind) return ''
  return t(`playbooks.procedure.entityKind.${kind}`, kind)
}

function actionVariantLabel(variant: string | null, t: Translate): string {
  if (!variant) return ''
  if (variant === 'notify') return t('playbooks.procedure.actionNotify', 'Notification')
  if (variant === 'task') return t('playbooks.procedure.actionTask', 'Task')
  if (variant === 'other') return t('playbooks.procedure.actionOther', 'Other')
  return variant
}

function formatStepHeading(step: Record<string, unknown>, t: Translate): string {
  const label = asString(step.label)
  const kind = asString(step.kind)
  const kindText = procedureKindLabel(kind, t)
  if (label && kindText) return `${label} (${kindText})`
  if (label) return label
  return kindText || '—'
}

function formatPlaybookHeading(playbook: Record<string, unknown>, t: Translate): string {
  const title = asString(playbook.title)
  const slug = asString(playbook.slug)
  const version = asNumber(playbook.version)
  const withVersion = formatProcedurePlaybookLabel(title ?? '', version, t)
  if (withVersion.length && slug) return `${withVersion} · ${slug}`
  if (withVersion.length) return withVersion
  return slug ?? '—'
}

type DetailRow = { key: string; label: string; value: string }

function pushRow(rows: DetailRow[], key: string, label: string, value: string | null | undefined) {
  const v = typeof value === 'string' ? value.trim() : ''
  if (!v.length) return
  rows.push({ key, label, value: v })
}

function collectStepRows(
  rows: DetailRow[],
  step: Record<string, unknown>,
  prefixKey: string,
  stepLabel: string,
  t: Translate,
) {
  pushRow(rows, `${prefixKey}.heading`, stepLabel, formatStepHeading(step, t))
  const instructions = asString(step.instructions)
  pushRow(rows, `${prefixKey}.instructions`, t('cases.timeline.detail.instructions', 'Instructions'), instructions)
  const taskTitle = asString(step.taskTitle)
  pushRow(rows, `${prefixKey}.taskTitle`, t('cases.timeline.detail.taskTitle', 'Task title'), taskTitle)
  const actionVariant = asString(step.actionVariant)
  if (actionVariant) {
    pushRow(
      rows,
      `${prefixKey}.actionVariant`,
      t('cases.timeline.detail.actionType', 'Action type'),
      actionVariantLabel(actionVariant, t),
    )
  }
  const conditionMode = asString(step.conditionMode)
  if (conditionMode) {
    pushRow(
      rows,
      `${prefixKey}.conditionMode`,
      t('cases.timeline.detail.conditionMode', 'Condition mode'),
      t(`cases.timeline.detail.conditionMode.${conditionMode}`, conditionMode),
    )
  }
  const entityKind = asString(step.entityKind)
  if (entityKind) {
    pushRow(
      rows,
      `${prefixKey}.entityKind`,
      t('cases.timeline.detail.entityKind', 'Entity type'),
      entityKindLabel(entityKind, t),
    )
  }
  const notifyChannel = asString(step.notifyChannel)
  pushRow(
    rows,
    `${prefixKey}.notifyChannel`,
    t('cases.timeline.detail.notifyChannel', 'Channel'),
    notifyChannel
      ? t(`cases.timeline.detail.notifyChannel.${notifyChannel}`, notifyChannel)
      : null,
  )
  const notifyTarget = asString(step.notifyTarget)
  pushRow(
    rows,
    `${prefixKey}.notifyTarget`,
    t('cases.timeline.detail.notifyTarget', 'Recipient'),
    notifyTarget
      ? t(`cases.timeline.detail.notifyTarget.${notifyTarget}`, notifyTarget)
      : null,
  )
  const notifyBody = asString(step.notifyBody)
  pushRow(rows, `${prefixKey}.notifyBody`, t('cases.timeline.detail.notifyTemplate', 'Message template'), notifyBody)
  const sourceStepId = asString(step.sourceStepId)
  pushRow(rows, `${prefixKey}.sourceStepId`, t('cases.timeline.detail.sourceStepId', 'Step id'), sourceStepId)
  const slugs = Array.isArray(step.playbookSlugs)
    ? step.playbookSlugs.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
    : []
  if (slugs.length) {
    pushRow(
      rows,
      `${prefixKey}.playbookSlugs`,
      t('cases.timeline.detail.linkedProcedures', 'Linked procedures'),
      slugs.join(', '),
    )
  }
}

export function CaseTimelineSystemBody({
  bodyKey,
  sourceRef,
  t,
}: {
  bodyKey: string
  sourceRef: Record<string, unknown> | null | undefined
  t: Translate
}) {
  const head = t(bodyKey, bodyKey)
  const ref = sourceRef && typeof sourceRef === 'object' ? sourceRef : null
  const rows: DetailRow[] = []

  if (ref) {
    const playbook = asRecord(ref.playbook)
    if (playbook) {
      pushRow(
        rows,
        'playbook',
        t('cases.timeline.detail.procedure', 'Procedure'),
        formatPlaybookHeading(playbook, t),
      )
    }

    const step = asRecord(ref.step)
    if (step) {
      collectStepRows(rows, step, 'step', t('cases.timeline.detail.step', 'Step'), t)
    }

    const branch = asString(ref.branch)
    if (branch === 'yes' || branch === 'no') {
      pushRow(
        rows,
        'branch',
        t('cases.timeline.detail.conditionAnswer', 'Answer'),
        branch === 'yes'
          ? t('cases.detail.procedure.yes', 'Yes')
          : t('cases.detail.procedure.no', 'No'),
      )
    }

    const nextStep = asRecord(ref.nextStep)
    if (nextStep) {
      collectStepRows(rows, nextStep, 'nextStep', t('cases.timeline.detail.nextStep', 'Next step'), t)
    }

    const targetStep = asRecord(ref.targetStep)
    if (targetStep) {
      collectStepRows(rows, targetStep, 'targetStep', t('cases.timeline.detail.targetStep', 'Jump target'), t)
    }

    // Entity selection (nested or legacy flat)
    const entityLabel = asString(ref.label)
    const entityKind = asString(ref.entityKind)
    const entityId = asString(ref.entityId)
    if (entityId || entityLabel) {
      pushRow(
        rows,
        'selectedEntity',
        t('cases.timeline.detail.selectedEntity', 'Selected entity'),
        [
          entityKind ? entityKindLabel(entityKind, t) : null,
          entityLabel,
          !entityLabel && entityId ? entityId : null,
        ]
          .filter((part): part is string => typeof part === 'string' && part.length > 0)
          .join(' · '),
      )
    } else if (entityKind && !step) {
      pushRow(
        rows,
        'selectedEntityKind',
        t('cases.timeline.detail.entityKind', 'Entity type'),
        entityKindLabel(entityKind, t),
      )
    }

    // Notify extras
    pushRow(rows, 'subject', t('cases.timeline.detail.subject', 'Subject'), asString(ref.subject))
    pushRow(
      rows,
      'bodyPreview',
      t('cases.timeline.detail.messageBody', 'Message'),
      asString(ref.bodyPreview),
    )

    // Task scheduled (legacy title + nested)
    const scheduledTitle = asString(ref.title)
    if (scheduledTitle && (asString(ref.kind) === 'procedure_task_scheduled' || bodyKey.includes('procedure_task_scheduled'))) {
      pushRow(rows, 'scheduledTitle', t('cases.timeline.detail.scheduledTask', 'Scheduled task'), scheduledTitle)
    }
    pushRow(rows, 'taskBody', t('cases.timeline.detail.taskNotes', 'Task notes'), asString(ref.taskBody))

    // Invoke launched legacy flat fields when playbook nest missing title
    if (!playbook) {
      const slug = asString(ref.slug)
      const title = asString(ref.title)
      const version = asNumber(ref.version)
      if (slug || title) {
        const detail =
          title && version !== null
            ? `${title} (${slug ?? '—'}) · v${version}`
            : title
              ? `${title}${slug ? ` (${slug})` : ''}`
              : slug ?? '—'
        pushRow(rows, 'invokePlaybook', t('cases.timeline.detail.procedure', 'Procedure'), detail)
      }
    }

    const previousTitle = asString(ref.previousPlaybookTitle)
    const previousSlug = asString(ref.previousPlaybookSlug)
    if (previousTitle || previousSlug) {
      pushRow(
        rows,
        'previousPlaybook',
        t('cases.timeline.detail.previousProcedure', 'Previous procedure'),
        previousTitle && previousSlug
          ? `${previousTitle} (${previousSlug})`
          : previousTitle ?? previousSlug,
      )
    }

    // invoke_procedure_step resolved list (legacy)
    const resolved = Array.isArray(ref.resolved) ? ref.resolved : null
    if (resolved?.length) {
      const lines = resolved
        .map((entry) => {
          const rec = asRecord(entry)
          if (!rec) return null
          const slug = asString(rec.slug) ?? ''
          const title = asString(rec.title) ?? ''
          const ver = asNumber(rec.version)
          const playbookId = asString(rec.playbookId)
          if (!slug.length && !playbookId) return null
          const missing = !playbookId?.length
          const label =
            title.length && ver !== null
              ? `${title} (${slug}) · v${ver}`
              : title.length
                ? `${title} (${slug})`
                : slug
          return missing
            ? `${label} — ${t('cases.timeline.invokeProcedureMissing', 'no active version')}`
            : label
        })
        .filter((line): line is string => typeof line === 'string' && line.length > 0)
      if (lines.length) {
        pushRow(
          rows,
          'resolved',
          t('cases.timeline.detail.linkedProcedures', 'Linked procedures'),
          lines.join('\n'),
        )
      }
    }
  }

  if (!rows.length) {
    return <div>{head}</div>
  }

  return (
    <>
      <div>{head}</div>
      <dl className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
        {rows.map((row) => (
          <div key={row.key} className="grid gap-0.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-3">
            <dt className="text-muted-foreground text-xs font-medium">{row.label}</dt>
            <dd className="text-foreground whitespace-pre-wrap text-xs sm:text-sm">{row.value}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}
