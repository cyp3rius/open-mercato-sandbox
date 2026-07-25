"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { Label } from '@open-mercato/ui/primitives/label'
import { Textarea } from '@open-mercato/ui/primitives/textarea'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@open-mercato/ui/primitives/tabs'
import { apiCall, readApiResultOrThrow } from '@open-mercato/ui/backend/utils/apiCall'
import { updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { CRUD_FORM_TEXT_INPUT_CLASS, CRUD_FORM_TEXTAREA_CLASS } from '@open-mercato/ui/backend/CrudForm'
import { EntitySearchCombobox, type EntitySearchComboboxOption } from '@open-mercato/ui/backend/inputs/EntitySearchCombobox'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useGuardedMutation } from '@open-mercato/ui/backend/injection/useGuardedMutation'
import type { PartnerIncentiveBase } from '../../../../components/PartnerIncentiveBaseRadioGroup'
import { PartnerIncentiveCombinedField } from '../../../../components/PartnerIncentiveCombinedField'

type ProgramRecord = {
  id: string
  name: string
  description?: string | null
  validFrom?: string | null
  validTo?: string | null
  isActive?: boolean
  incentivePercent?: string | number | null
  incentive_percent?: string | number | null
  incentiveBase?: string | null
  incentive_base?: string | null
}

type MembershipRow = {
  id: string
  customerEntityId: string
  role: string | null
  joinedAt: string
}

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function PartnerProgramDetailPage({ params }: { params?: { id?: string } }) {
  const programId = params?.id
  const t = useT()
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [tab, setTab] = React.useState<'details' | 'partners'>('details')
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [validFrom, setValidFrom] = React.useState('')
  const [validTo, setValidTo] = React.useState('')
  const [isActive, setIsActive] = React.useState(true)
  const [incentivePercent, setIncentivePercent] = React.useState('0')
  const [incentiveBase, setIncentiveBase] = React.useState<PartnerIncentiveBase>('net')
  const [loaded, setLoaded] = React.useState(false)
  const [canEdit, setCanEdit] = React.useState(false)
  const [canMembers, setCanMembers] = React.useState(false)
  const [members, setMembers] = React.useState<MembershipRow[]>([])
  const [memberLabels, setMemberLabels] = React.useState<Record<string, string>>({})
  const [pickCustomerId, setPickCustomerId] = React.useState('')
  const [pickRole, setPickRole] = React.useState('')
  const [adding, setAdding] = React.useState(false)

  const { runMutation } = useGuardedMutation<{ programId: string }>({
    contextId: programId ? `partner_programs:program:${programId}` : 'partner_programs:program',
  })

  React.useEffect(() => {
    let cancelled = false
    async function loadPerm() {
      const call = await apiCall<{ granted?: string[]; ok?: boolean }>('/api/auth/feature-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          features: ['partner_programs.edit', 'partner_programs.manage_memberships'],
        }),
      })
      if (cancelled) return
      const granted = Array.isArray(call.result?.granted) ? call.result.granted : []
      setCanEdit(call.result?.ok === true || granted.includes('partner_programs.edit'))
      setCanMembers(call.result?.ok === true || granted.includes('partner_programs.manage_memberships'))
    }
    void loadPerm()
    return () => {
      cancelled = true
    }
  }, [])

  const loadProgram = React.useCallback(async () => {
    if (!programId) return
    const payload = await readApiResultOrThrow<{ items?: ProgramRecord[] }>(
      `/api/partner_programs/programs?page=1&pageSize=1&ids=${encodeURIComponent(programId)}`,
      undefined,
      { errorMessage: t('partner_programs.form.errors.load', 'Failed to load program.') },
    )
    const record = Array.isArray(payload.items) ? payload.items[0] : null
    if (!record) throw new Error(t('partner_programs.form.errors.load', 'Failed to load program.'))
    setName(record.name ?? '')
    setDescription(record.description ?? '')
    setValidFrom(toDatetimeLocalValue(record.validFrom))
    setValidTo(toDatetimeLocalValue(record.validTo))
    setIsActive(record.isActive !== false)
    const percentRaw = record.incentivePercent ?? record.incentive_percent ?? '0'
    setIncentivePercent(String(percentRaw))
    const baseRaw = record.incentiveBase ?? record.incentive_base ?? 'net'
    setIncentiveBase(baseRaw === 'gross' ? 'gross' : 'net')
    setLoaded(true)
  }, [programId, t])

  const loadMembers = React.useCallback(async () => {
    if (!programId) return
    const payload = await readApiResultOrThrow<{ items?: MembershipRow[] }>(
      `/api/partner_programs/programs/${encodeURIComponent(programId)}/memberships`,
      undefined,
      { errorMessage: t('partner_programs.partners.errors.load', 'Failed to load partners.') },
    )
    const items = Array.isArray(payload.items) ? payload.items : []
    setMembers(items)
    const ids = items.map((m) => m.customerEntityId).filter(Boolean)
    if (ids.length === 0) return
    const params = new URLSearchParams({ page: '1', pageSize: '100', ids: ids.join(',') })
    const [companies, people] = await Promise.all([
      readApiResultOrThrow<{ items?: Array<{ id?: string; display_name?: string; displayName?: string }> }>(
        `/api/customers/companies?${params.toString()}`,
        undefined,
        { fallback: { items: [] } },
      ),
      readApiResultOrThrow<{ items?: Array<{ id?: string; display_name?: string; displayName?: string }> }>(
        `/api/customers/people?${params.toString()}`,
        undefined,
        { fallback: { items: [] } },
      ),
    ])
    const map: Record<string, string> = {}
    for (const row of [...(companies.items ?? []), ...(people.items ?? [])]) {
      if (typeof row.id !== 'string') continue
      const label =
        (typeof row.display_name === 'string' && row.display_name) ||
        (typeof row.displayName === 'string' && row.displayName) ||
        row.id
      map[row.id] = label
    }
    setMemberLabels((prev) => ({ ...prev, ...map }))
  }, [programId, t])

  React.useEffect(() => {
    if (!programId) return
    let cancelled = false
    void (async () => {
      try {
        await loadProgram()
      } catch {
        if (!cancelled) flash(t('partner_programs.form.errors.load', 'Failed to load program.'), 'error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loadProgram, programId, t])

  React.useEffect(() => {
    if (!programId || tab !== 'partners') return
    void loadMembers().catch(() => flash(t('partner_programs.partners.errors.load', 'Failed to load partners.'), 'error'))
  }, [loadMembers, programId, tab])

  const searchPartners = React.useCallback(
    async (query: string): Promise<EntitySearchComboboxOption[]> => {
      const params = new URLSearchParams({
        page: '1',
        pageSize: '20',
        crmRecordTypes: 'partner',
      })
      if (query.trim()) params.set('search', query.trim())
      const qs = params.toString()
      const [companies, people] = await Promise.all([
        readApiResultOrThrow<{ items?: Array<{ id?: string; display_name?: string; displayName?: string }> }>(
          `/api/customers/companies?${qs}`,
          undefined,
          { fallback: { items: [] } },
        ),
        readApiResultOrThrow<{ items?: Array<{ id?: string; display_name?: string; displayName?: string }> }>(
          `/api/customers/people?${qs}`,
          undefined,
          { fallback: { items: [] } },
        ),
      ])
      const personPrefix = t('partner_programs.partners.kindPerson', 'Person')
      const companyPrefix = t('partner_programs.partners.kindCompany', 'Company')
      const out: EntitySearchComboboxOption[] = []
      for (const row of people.items ?? []) {
        if (typeof row.id !== 'string') continue
        const label =
          (typeof row.display_name === 'string' && row.display_name) ||
          (typeof row.displayName === 'string' && row.displayName) ||
          row.id
        out.push({ value: row.id, label: `${personPrefix}: ${label}` })
      }
      for (const row of companies.items ?? []) {
        if (typeof row.id !== 'string') continue
        const label =
          (typeof row.display_name === 'string' && row.display_name) ||
          (typeof row.displayName === 'string' && row.displayName) ||
          row.id
        out.push({ value: row.id, label: `${companyPrefix}: ${label}` })
      }
      out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }))
      return out
    },
    [t],
  )

  const handleSaveDetails = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!programId || !name.trim()) {
        flash(t('partner_programs.form.errors.nameRequired', 'Name is required.'), 'error')
        return
      }
      const percent = Number(incentivePercent)
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
        flash(
          t(
            'partner_programs.form.errors.incentivePercentInvalid',
            'Incentive percent must be between 0 and 100.',
          ),
          'error',
        )
        return
      }
      const body: Record<string, unknown> = {
        id: programId,
        name: name.trim(),
        description: description.trim() || null,
        isActive,
        incentivePercent: percent,
        incentiveBase,
      }
      if (validFrom.trim()) body.validFrom = new Date(validFrom).toISOString()
      else body.validFrom = null
      if (validTo.trim()) body.validTo = new Date(validTo).toISOString()
      else body.validTo = null
      try {
        await updateCrud('partner_programs/programs', body, {
          errorMessage: t('partner_programs.form.errors.save', 'Failed to save program.'),
        })
        flash(t('partner_programs.form.flash.updated', 'Program updated.'), 'success')
      } catch (err) {
        const message = err instanceof Error ? err.message : t('partner_programs.form.errors.save', 'Failed to save program.')
        flash(message, 'error')
      }
    },
    [description, incentiveBase, incentivePercent, isActive, name, programId, t, validFrom, validTo],
  )

  const handleDeleteProgram = React.useCallback(async () => {
    if (!programId) return
    const confirmed = await confirm({
      title: t('partner_programs.list.actions.deleteConfirm', 'Delete program "{{name}}"?').replace('{{name}}', name || programId),
      variant: 'destructive',
    })
    if (!confirmed) return
    try {
      await deleteCrud('partner_programs/programs', programId, {
        errorMessage: t('partner_programs.list.errors.delete', 'Failed to delete program.'),
      })
      flash(t('partner_programs.list.messages.deleted', 'Program deleted.'), 'success')
      router.push('/backend/partner_programs/programs')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('partner_programs.list.errors.delete', 'Failed to delete program.')
      flash(message, 'error')
    }
  }, [confirm, name, programId, router, t])

  const handleAddMember = React.useCallback(async () => {
    if (!programId || !pickCustomerId.trim()) {
      flash(t('partner_programs.partners.errors.pickPartner', 'Select a partner.'), 'error')
      return
    }
    setAdding(true)
    try {
      await runMutation({
        context: { programId },
        operation: async () => {
          const res = await fetch(`/api/partner_programs/programs/${encodeURIComponent(programId)}/memberships`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              customerEntityId: pickCustomerId.trim(),
              role: pickRole.trim() || null,
            }),
          })
          const body = await res.json().catch(() => ({}))
          if (!res.ok) {
            const msg =
              typeof (body as { error?: string }).error === 'string' ? (body as { error: string }).error : 'Failed'
            throw new Error(msg)
          }
        },
      })
      flash(t('partner_programs.partners.messages.added', 'Partner added.'), 'success')
      setPickCustomerId('')
      setPickRole('')
      await loadMembers()
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t('partner_programs.partners.errors.add', 'Failed to add partner.')
      flash(message, 'error')
    } finally {
      setAdding(false)
    }
  }, [loadMembers, pickCustomerId, pickRole, programId, runMutation, t])

  const handleRemoveMember = React.useCallback(
    async (membershipId: string) => {
      const ok = await confirm({
        title: t('partner_programs.partners.table.removeConfirm', 'Remove this partner from the program?'),
        variant: 'destructive',
      })
      if (!ok) return
      try {
        await runMutation({
          context: { programId: programId! },
          operation: async () => {
            const res = await fetch(
              `/api/partner_programs/programs/${encodeURIComponent(programId!)}/memberships?id=${encodeURIComponent(membershipId)}`,
              { method: 'DELETE' },
            )
            if (!res.ok) {
              const body = await res.json().catch(() => ({}))
              const msg =
                typeof (body as { error?: string }).error === 'string' ? (body as { error: string }).error : 'Failed'
              throw new Error(msg)
            }
          },
        })
        flash(t('partner_programs.partners.messages.removed', 'Partner removed.'), 'success')
        await loadMembers()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t('partner_programs.partners.errors.remove', 'Failed to remove partner.')
        flash(message, 'error')
      }
    },
    [confirm, loadMembers, programId, runMutation, t],
  )

  if (!programId) {
    return null
  }

  return (
    <Page>
      <PageBody className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/backend/partner_programs/programs">{t('partner_programs.form.back', 'Programs')}</Link>
          </Button>
          {canEdit ? (
            <Button type="button" variant="destructive" size="sm" onClick={() => void handleDeleteProgram()}>
              {t('partner_programs.list.actions.delete', 'Delete')}
            </Button>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {loaded ? name : t('partner_programs.form.editTitle', 'Program details')}
        </h1>
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'details' | 'partners')}>
          <TabsList>
            <TabsTrigger value="details">{t('partner_programs.form.editTitle', 'Program details')}</TabsTrigger>
            <TabsTrigger value="partners">{t('partner_programs.partners.tab', 'Partners')}</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="mt-4 space-y-4">
            <form className="space-y-4" onSubmit={handleSaveDetails}>
              <div className="space-y-2">
                <Label htmlFor="ppd-name">{t('partner_programs.form.name', 'Name')}</Label>
                <Input
                  id="ppd-name"
                  className={CRUD_FORM_TEXT_INPUT_CLASS}
                  value={name}
                  onChange={(ev) => setName(ev.target.value)}
                  disabled={!canEdit}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ppd-desc">{t('partner_programs.form.description', 'Description')}</Label>
                <Textarea
                  id="ppd-desc"
                  className={CRUD_FORM_TEXTAREA_CLASS}
                  value={description}
                  onChange={(ev) => setDescription(ev.target.value)}
                  disabled={!canEdit}
                  rows={4}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2 md:col-span-1">
                  <PartnerIncentiveCombinedField
                    percent={incentivePercent}
                    onPercentChange={setIncentivePercent}
                    base={incentiveBase}
                    onBaseChange={setIncentiveBase}
                    disabled={!canEdit}
                    percentLabel={t('partner_programs.form.incentivePercent', 'Incentive %')}
                    baseLabel={t('partner_programs.form.incentiveBase', 'Calculate from')}
                    netLabel={t('partner_programs.form.incentiveBaseNet', 'Net')}
                    grossLabel={t('partner_programs.form.incentiveBaseGross', 'Gross')}
                    hint={t(
                      'partner_programs.form.incentivePercentHint',
                      'Percent of referring order grand total credited to the partner.',
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ppd-vf">{t('partner_programs.form.validFrom', 'Valid from')}</Label>
                  <Input
                    id="ppd-vf"
                    type="datetime-local"
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    value={validFrom}
                    onChange={(ev) => setValidFrom(ev.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ppd-vt">{t('partner_programs.form.validTo', 'Valid to')}</Label>
                  <Input
                    id="ppd-vt"
                    type="datetime-local"
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    value={validTo}
                    onChange={(ev) => setValidTo(ev.target.value)}
                    disabled={!canEdit}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ppd-active"
                  checked={isActive}
                  onCheckedChange={(v) => setIsActive(v === true)}
                  disabled={!canEdit}
                />
                <Label htmlFor="ppd-active" className="font-normal">
                  {t('partner_programs.form.isActive', 'Active')}
                </Label>
              </div>
              {canEdit ? (
                <Button type="submit">{t('partner_programs.form.actions.save', 'Save')}</Button>
              ) : null}
            </form>
          </TabsContent>
          <TabsContent value="partners" className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              {t(
                'partner_programs.partners.description',
                'Only CRM records with type Partner can be added.',
              )}
            </p>
            {canMembers ? (
              <div className="space-y-3 rounded-lg border border-border p-4">
                <div className="space-y-2">
                  <Label>{t('partner_programs.partners.pickerLabel', 'Partner (person or company)')}</Label>
                  <EntitySearchCombobox
                    className="w-full"
                    value={pickCustomerId}
                    onChange={setPickCustomerId}
                    options={[]}
                    placeholder={t('partner_programs.partners.pickerPlaceholder', 'Search partners…')}
                    onRemoteSearch={searchPartners}
                    selectedDisplayOverride={
                      pickCustomerId && memberLabels[pickCustomerId] ? memberLabels[pickCustomerId] : undefined
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pp-role">{t('partner_programs.partners.role', 'Role (optional)')}</Label>
                  <Input
                    id="pp-role"
                    className={CRUD_FORM_TEXT_INPUT_CLASS}
                    value={pickRole}
                    onChange={(ev) => setPickRole(ev.target.value)}
                  />
                </div>
                <Button type="button" onClick={() => void handleAddMember()} disabled={adding}>
                  {t('partner_programs.partners.add', 'Add partner')}
                </Button>
              </div>
            ) : null}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-2">{t('partner_programs.partners.table.customer', 'Partner')}</th>
                    <th className="p-2">{t('partner_programs.partners.table.role', 'Role')}</th>
                    <th className="p-2">{t('partner_programs.partners.table.joinedAt', 'Joined')}</th>
                    {canMembers ? <th className="p-2">{t('partner_programs.partners.table.actions', 'Actions')}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={canMembers ? 4 : 3} className="p-4 text-muted-foreground">
                        {t('partner_programs.partners.table.empty', 'No partners in this program yet.')}
                      </td>
                    </tr>
                  ) : (
                    members.map((m) => (
                      <tr key={m.id} className="border-t border-border">
                        <td className="p-2 font-medium">
                          {memberLabels[m.customerEntityId] ?? m.customerEntityId}
                        </td>
                        <td className="p-2">{m.role ?? '—'}</td>
                        <td className="p-2">{new Date(m.joinedAt).toLocaleString()}</td>
                        {canMembers ? (
                          <td className="p-2">
                            <Button type="button" variant="outline" size="sm" onClick={() => void handleRemoveMember(m.id)}>
                              {t('partner_programs.partners.table.remove', 'Remove')}
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
        {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}
