"use client"

import * as React from 'react'
import { Button } from '@open-mercato/ui/primitives/button'
import { Label } from '@open-mercato/ui/primitives/label'
import { cn } from '@open-mercato/shared/lib/utils'
import { CRUD_FORM_SELECT_CLASS, CRUD_FORM_TEXT_INPUT_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { apiCallOrThrow, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import {
  POLICY_LIST_COLOR_FIELD_META,
  POLICY_LIST_COLOR_OPERATOR_SYMBOL,
  POLICY_LIST_COLOR_RULE_FIELDS,
  type PolicyListColorOperator,
  type PolicyListColorRule,
  type PolicyListColorRuleField,
  type PolicyListColorRulesPayload,
} from '@open-mercato/core/modules/insurance/lib/policyListColorRules'

function operatorsForField(field: PolicyListColorRuleField): PolicyListColorOperator[] {
  const kind = POLICY_LIST_COLOR_FIELD_META[field].kind
  if (kind === 'datetime') return ['eq', 'lt', 'gt', 'lte', 'gte']
  return ['eq']
}

function newRuleId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `rule_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function PolicyListColorRulesSection() {
  const t = useT()
  const [rules, setRules] = React.useState<PolicyListColorRule[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  const errorLoad = t('insurance_desk.config.policyColors.error.load', 'Failed to load color rules.')
  const errorSave = t('insurance_desk.config.policyColors.error.save', 'Failed to save color rules.')
  const successSave = t('insurance_desk.config.policyColors.success.save', 'Saved.')

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const data = await readApiResultOrThrow<PolicyListColorRulesPayload>(
        '/api/insurance/config-policy-list-color-rules',
        undefined,
        { errorMessage: errorLoad },
      )
      setRules(Array.isArray(data.rules) ? data.rules : [])
    } catch (err) {
      console.error('policy color rules load', err)
      flash(errorLoad, 'error')
    } finally {
      setLoading(false)
    }
  }, [errorLoad])

  React.useEffect(() => {
    void load()
  }, [load])

  const persist = React.useCallback(async () => {
    setSaving(true)
    try {
      await apiCallOrThrow<PolicyListColorRulesPayload>(
        '/api/insurance/config-policy-list-color-rules',
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ rules }),
        },
        { errorMessage: errorSave },
      )
      flash(successSave, 'success')
    } catch (err) {
      console.error('policy color rules save', err)
      const msg = err instanceof Error ? err.message : errorSave
      flash(msg, 'error')
    } finally {
      setSaving(false)
    }
  }, [errorSave, rules, successSave])

  const fieldLabel = React.useCallback(
    (field: PolicyListColorRuleField) =>
      t(`insurance_desk.config.policyColors.fields.${field}`, field),
    [t],
  )

  const addRule = React.useCallback(() => {
    const field: PolicyListColorRuleField = 'status'
    const ops = operatorsForField(field)
    setRules((prev) => [
      ...prev,
      {
        id: newRuleId(),
        field,
        operator: ops[0] ?? 'eq',
        value: '',
        color: '#22c55e',
      },
    ])
  }, [])

  const move = React.useCallback((index: number, dir: -1 | 1) => {
    setRules((prev) => {
      const next = [...prev]
      const j = index + dir
      if (j < 0 || j >= next.length) return prev
      const tmp = next[index]
      next[index] = next[j]!
      next[j] = tmp!
      return next
    })
  }, [])

  const removeAt = React.useCallback((index: number) => {
    setRules((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const patchRule = React.useCallback((index: number, patch: Partial<PolicyListColorRule>) => {
    setRules((prev) => {
      const next = [...prev]
      const cur = next[index]
      if (!cur) return prev
      let merged: PolicyListColorRule = { ...cur, ...patch }
      if (patch.field) {
        const ops = operatorsForField(patch.field)
        if (!ops.includes(merged.operator)) {
          merged = { ...merged, operator: ops[0] ?? 'eq' }
        }
      }
      if (patch.operator) {
        const kind = POLICY_LIST_COLOR_FIELD_META[cur.field].kind
        if (kind === 'datetime') {
          const prevEq = cur.operator === 'eq'
          const nextEq = patch.operator === 'eq'
          if (prevEq !== nextEq) {
            merged = { ...merged, value: '' }
          }
        }
      }
      next[index] = merged
      return next
    })
  }, [])

  return (
    <section className="rounded border bg-card text-card-foreground shadow-sm">
      <div className="space-y-1 border-b px-6 py-4">
        <h2 className="text-lg font-medium">
          {t('insurance_desk.config.policyColors.heading', 'Policy list row colors')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(
            'insurance_desk.config.policyColors.description',
            'Rules are evaluated from top to bottom; the first matching rule sets the row color.',
          )}
        </p>
      </div>
      <div className="space-y-4 px-6 py-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>
        ) : (
          <>
            <div className="space-y-3">
              {rules.map((rule, index) => {
                const ops = operatorsForField(rule.field)
                const isDate = POLICY_LIST_COLOR_FIELD_META[rule.field].kind === 'datetime'
                const isEqDate = isDate && rule.operator === 'eq'
                return (
                  <div
                    key={rule.id}
                    className="grid gap-3 rounded-md border border-border/70 p-3 md:grid-cols-12 md:items-end"
                  >
                    <div className="space-y-1 md:col-span-3">
                      <Label className="text-xs">{t('insurance_desk.config.policyColors.field', 'Field')}</Label>
                      <select
                        className={CRUD_FORM_SELECT_CLASS}
                        value={rule.field}
                        onChange={(e) => patchRule(index, { field: e.target.value as PolicyListColorRuleField })}
                      >
                        {POLICY_LIST_COLOR_RULE_FIELDS.map((f) => (
                          <option key={f} value={f}>
                            {fieldLabel(f)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs">{t('insurance_desk.config.policyColors.operator', 'Condition')}</Label>
                      <select
                        className={CRUD_FORM_SELECT_CLASS}
                        value={rule.operator}
                        onChange={(e) => patchRule(index, { operator: e.target.value as PolicyListColorOperator })}
                      >
                        {ops.map((op) => (
                          <option key={op} value={op}>
                            {POLICY_LIST_COLOR_OPERATOR_SYMBOL[op]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1 md:col-span-3">
                      <Label className="text-xs">{t('insurance_desk.config.policyColors.value', 'Value')}</Label>
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type={isEqDate ? 'date' : isDate ? 'number' : 'text'}
                          className={cn(CRUD_FORM_TEXT_INPUT_CLASS, 'min-w-[8rem] flex-1 font-mono')}
                          value={
                            isEqDate && rule.value.length >= 10
                              ? rule.value.slice(0, 10)
                              : isDate && !isEqDate
                                ? rule.value.replace(/\D/g, '')
                                : rule.value
                          }
                          min={isDate && !isEqDate ? 0 : undefined}
                          onChange={(e) => {
                            const v = e.target.value
                            if (isEqDate && v.length === 10) {
                              patchRule(index, { value: `${v}T00:00:00.000Z` })
                              return
                            }
                            if (isDate && !isEqDate) {
                              patchRule(index, { value: v.replace(/\D/g, '') })
                              return
                            }
                            patchRule(index, { value: v })
                          }}
                          data-crud-focus-target=""
                        />
                        {isDate && !isEqDate ? (
                          <span className="text-xs text-muted-foreground">
                            {t('insurance_desk.config.policyColors.daysUnit', 'days')}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs">{t('insurance_desk.config.policyColors.color', 'Color')}</Label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={rule.color.length === 7 && rule.color.startsWith('#') ? rule.color : '#000000'}
                          onChange={(e) => patchRule(index, { color: e.target.value })}
                          className="h-9 w-14 cursor-pointer rounded border p-1"
                        />
                        <input
                          className={cn(CRUD_FORM_TEXT_INPUT_CLASS, 'min-w-0 flex-1 font-mono')}
                          value={rule.color}
                          onChange={(e) => patchRule(index, { color: e.target.value })}
                          data-crud-focus-target=""
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 md:col-span-2 md:justify-end">
                      <Button type="button" variant="outline" size="sm" onClick={() => move(index, -1)} disabled={index === 0}>
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => move(index, 1)}
                        disabled={index >= rules.length - 1}
                      >
                        ↓
                      </Button>
                      <Button type="button" variant="destructive" size="sm" onClick={() => removeAt(index)}>
                        {t('common.delete', 'Delete')}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={addRule}>
                {t('insurance_desk.config.policyColors.addRule', 'Add rule')}
              </Button>
              <Button type="button" size="sm" onClick={() => void persist()} disabled={saving}>
                {t('insurance_desk.config.policyColors.save', 'Save rules')}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                {t('insurance_desk.config.dictionaries.actions.refresh', 'Refresh')}
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
