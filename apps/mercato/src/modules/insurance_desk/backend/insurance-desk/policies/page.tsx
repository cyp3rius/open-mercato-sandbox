"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ColumnDef } from '@tanstack/react-table'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { renderDictionaryIcon } from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'
import {
  resolvePolicyListRowColor,
  ruleHexToStrongForeground,
  resolvePolicyListRowMatchingRule,
  type PolicyListColorEvaluationRow,
  type PolicyListColorRule,
  type PolicyListColorRuleField,
} from '@open-mercato/core/modules/insurance/lib/policyListColorRules'
import { INSURANCE_DESK_BASE } from '../paths'
import { fetchPartnerLabelsByIds, fetchResourceNamesByIds } from '../../../lib/policyListLookups'

const PAGE_SIZE = 20

type PolicyRow = {
  id: string
  policyNumber: string
  insurerId: string
  referringPartnerEntityId: string | null
  catalogProductId: string | null
  resourceId: string | null
  status: string | null
  validFrom: string | null
  validTo: string | null
  createdAt: string | null
  updatedAt: string | null
}

type StatusDictEntry = { value: string; label: string; icon?: string; color?: string }

type InsurerRow = { id: string; name: string; code: string }

type ListResponse = {
  items: PolicyRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

type InsurersResponse = { items: InsurerRow[] }

function shortId(value: string | null, len = 8) {
  if (!value) return '—'
  return value.length > len ? `${value.slice(0, len)}…` : value
}

function formatIsoDate(iso: string | null): string {
  if (!iso?.length) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString()
}

function hexToRgba(hex: string, alpha: number): string | undefined {
  const t = hex.trim()
  const m = /^#?([0-9a-fA-F]{6})$/.exec(t)
  if (!m?.[1]) return undefined
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}

const COLUMN_RULE_FIELD: Record<string, PolicyListColorRuleField> = {
  policyNumber: 'policyNumber',
  resourceId: 'resourceId',
  status: 'status',
  validFrom: 'validFrom',
  validTo: 'validTo',
  insurer: 'insurerId',
  referringPartnerEntityId: 'referringPartnerEntityId',
}

function buildPolicyEvalRow(row: PolicyRow): PolicyListColorEvaluationRow {
  return {
    policyNumber: row.policyNumber,
    status: row.status,
    validFrom: row.validFrom,
    validTo: row.validTo,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    insurerId: row.insurerId,
    referringPartnerEntityId: row.referringPartnerEntityId,
    catalogProductId: row.catalogProductId,
    resourceId: row.resourceId,
  }
}

export default function InsurancePoliciesListPage() {
  const router = useRouter()
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [rows, setRows] = React.useState<PolicyRow[]>([])
  const [insurerById, setInsurerById] = React.useState<Map<string, InsurerRow>>(new Map())
  const [partnerById, setPartnerById] = React.useState<Map<string, string>>(new Map())
  const [resourceById, setResourceById] = React.useState<Map<string, string>>(new Map())
  const [statusDict, setStatusDict] = React.useState<StatusDictEntry[]>([])
  const [colorRules, setColorRules] = React.useState<PolicyListColorRule[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [canManage, setCanManage] = React.useState(false)
  const [reloadToken, setReloadToken] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    async function loadPerm() {
      const call = await apiCall<{ granted?: string[]; ok?: boolean }>('/api/auth/feature-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ features: ['insurance.policies.manage'] }),
      })
      if (cancelled) return
      const granted = Array.isArray(call.result?.granted) ? call.result?.granted : []
      setCanManage(call.result?.ok === true || granted.includes('insurance.policies.manage'))
    }
    loadPerm()
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    async function loadInsurers() {
      const call = await apiCall<InsurersResponse>('/api/insurance/insurers?page=1&pageSize=100')
      if (cancelled || !call.ok || !call.result?.items) return
      const map = new Map<string, InsurerRow>()
      for (const item of call.result.items) {
        map.set(item.id, item)
      }
      setInsurerById(map)
    }
    loadInsurers()
    return () => {
      cancelled = true
    }
  }, [scopeVersion])

  React.useEffect(() => {
    let cancelled = false
    async function loadAux() {
      const [st, cr] = await Promise.all([
        apiCall<{ entries?: StatusDictEntry[] }>('/api/insurance/config-policy-status'),
        apiCall<{ rules?: PolicyListColorRule[] }>('/api/insurance/config-policy-list-color-rules'),
      ])
      if (cancelled) return
      setStatusDict(Array.isArray(st.result?.entries) ? st.result.entries : [])
      setColorRules(Array.isArray(cr.result?.rules) ? cr.result.rules : [])
    }
    void loadAux()
    return () => {
      cancelled = true
    }
  }, [scopeVersion])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          search: search.trim(),
          sortField: 'validFrom',
          sortDir: 'desc',
        })
        const call = await apiCall<ListResponse>(`/api/insurance/policies?${params.toString()}`)
        if (cancelled) return
        if (!call.ok || !call.result) {
          setRows([])
          setTotal(0)
          setTotalPages(1)
          return
        }
        const list = Array.isArray(call.result.items) ? call.result.items : []
        setRows(list)
        setTotal(typeof call.result.total === 'number' ? call.result.total : 0)
        setTotalPages(typeof call.result.totalPages === 'number' ? call.result.totalPages : 1)

        const partnerIds = list.map((r) => r.referringPartnerEntityId).filter(Boolean)
        const resourceIds = list.map((r) => r.resourceId).filter((x): x is string => typeof x === 'string' && x.length > 0)
        const [pMap, rMap] = await Promise.all([
          fetchPartnerLabelsByIds(partnerIds),
          fetchResourceNamesByIds(resourceIds),
        ])
        if (!cancelled) {
          setPartnerById(pMap)
          setResourceById(rMap)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [page, search, scopeVersion, reloadToken])

  const statusByValue = React.useMemo(() => {
    const m = new Map<string, StatusDictEntry>()
    for (const e of statusDict) {
      if (e.value.trim().length) m.set(e.value.trim(), e)
    }
    return m
  }, [statusDict])

  const rowMatchingRuleById = React.useMemo(() => {
    const m = new Map<string, PolicyListColorRule>()
    for (const row of rows) {
      const hit = resolvePolicyListRowMatchingRule(buildPolicyEvalRow(row), colorRules)
      if (hit) m.set(row.id, hit)
    }
    return m
  }, [rows, colorRules])

  const columns = React.useMemo<ColumnDef<PolicyRow>[]>(() => {
    const wrapRuleField = (rowId: string, columnId: string, node: React.ReactNode) => {
      const rule = rowMatchingRuleById.get(rowId)
      const field = COLUMN_RULE_FIELD[columnId]
      if (!rule || !field || rule.field !== field) return node
      const color = ruleHexToStrongForeground(rule.color)
      return (
        <span className="font-bold" style={{ color }}>
          {node}
        </span>
      )
    }

    return [
      {
        id: 'policyNumber',
        header: t('insurance_desk.policies.col.number', 'Policy number'),
        accessorKey: 'policyNumber',
        cell: ({ row }) =>
          wrapRuleField(row.original.id, 'policyNumber', row.original.policyNumber),
        meta: { truncate: true, maxWidth: 200 },
      },
      {
        id: 'resourceId',
        header: t('insurance_desk.policies.col.insuranceSubject', 'Subject of insurance'),
        cell: ({ row }) => {
          const id = row.original.resourceId
          const text = !id ? '—' : resourceById.get(id) ?? shortId(id)
          return wrapRuleField(row.original.id, 'resourceId', text)
        },
        meta: { truncate: true, maxWidth: 220 },
      },
      {
        id: 'status',
        header: t('insurance_desk.policies.col.status', 'Status'),
        cell: ({ row }) => {
          const raw = row.original.status?.trim() ?? ''
          if (!raw.length) return wrapRuleField(row.original.id, 'status', '—')
          const entry = statusByValue.get(raw)
          const label = entry?.label ?? raw
          const icon = entry?.icon?.trim()
          const color = entry?.color?.trim()
          const inner = (
            <span className="inline-flex items-center gap-2">
              {icon ? (
                <span className="shrink-0 text-muted-foreground">{renderDictionaryIcon(icon, 'h-4 w-4')}</span>
              ) : null}
              {color ? (
                <span className="inline-block size-2.5 shrink-0 rounded-full border border-border" style={{ backgroundColor: color }} />
              ) : null}
              <span className="truncate">{label}</span>
            </span>
          )
          return wrapRuleField(row.original.id, 'status', inner)
        },
        meta: { truncate: true, maxWidth: 240 },
      },
      {
        id: 'validFrom',
        header: t('insurance_desk.policies.col.validFrom', 'Valid from'),
        accessorKey: 'validFrom',
        cell: ({ row }) =>
          wrapRuleField(row.original.id, 'validFrom', formatIsoDate(row.original.validFrom)),
      },
      {
        id: 'validTo',
        header: t('insurance_desk.policies.col.validTo', 'Valid to'),
        accessorKey: 'validTo',
        cell: ({ row }) =>
          wrapRuleField(row.original.id, 'validTo', formatIsoDate(row.original.validTo)),
      },
      {
        id: 'insurer',
        header: t('insurance_desk.policies.col.insurer', 'Insurer'),
        cell: ({ row }) => {
          const ins = insurerById.get(row.original.insurerId)
          const text = ins ? `${ins.code} — ${ins.name}` : shortId(row.original.insurerId)
          return wrapRuleField(row.original.id, 'insurer', text)
        },
        meta: { truncate: true, maxWidth: 220 },
      },
      {
        id: 'referringPartnerEntityId',
        header: t('insurance_desk.policies.col.partner', 'Referring party'),
        cell: ({ row }) => {
          const id = row.original.referringPartnerEntityId
          const text =
            id == null || !String(id).trim().length
              ? '—'
              : partnerById.get(id) ?? shortId(id, 12)
          return wrapRuleField(row.original.id, 'referringPartnerEntityId', text)
        },
      },
    ]
  }, [insurerById, partnerById, resourceById, rowMatchingRuleById, statusByValue, t])

  const rowStyle = React.useCallback(
    (row: PolicyRow) => {
      const evalRow: PolicyListColorEvaluationRow = {
        policyNumber: row.policyNumber,
        status: row.status,
        validFrom: row.validFrom,
        validTo: row.validTo,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        insurerId: row.insurerId,
        referringPartnerEntityId: row.referringPartnerEntityId,
        catalogProductId: row.catalogProductId,
        resourceId: row.resourceId,
      }
      const color = resolvePolicyListRowColor(evalRow, colorRules)
      if (!color) return undefined
      const bg = hexToRgba(color, 0.12) ?? `${color}22`
      return { backgroundColor: bg }
    },
    [colorRules],
  )

  return (
    <Page>
      <PageBody>
        <DataTable<PolicyRow>
          title={t('insurance_desk.policies.title', 'Policies')}
          entityId="insurance_desk:policies"
          data={rows}
          columns={columns}
          rowStyle={rowStyle}
          onRowClick={
            canManage
              ? (row) => {
                  router.push(`${INSURANCE_DESK_BASE}/policies/${encodeURIComponent(row.id)}`)
                }
              : undefined
          }
          searchValue={search}
          onSearchChange={setSearch}
          isLoading={isLoading}
          actions={
            canManage ? (
              <Button asChild>
                <Link href={`${INSURANCE_DESK_BASE}/policies/create`}>
                  {t('insurance_desk.policies.create', 'Add policy')}
                </Link>
              </Button>
            ) : null
          }
          pagination={{
            page,
            pageSize: PAGE_SIZE,
            total,
            totalPages,
            onPageChange: setPage,
          }}
          rowActions={
            canManage
              ? (row) => (
                  <RowActions
                    items={[
                      {
                        id: 'viewDetails',
                        label: t('insurance_desk.policies.viewDetails', 'View details'),
                        onSelect: () => {
                          router.push(`${INSURANCE_DESK_BASE}/policies/${encodeURIComponent(row.id)}`)
                        },
                      },
                      {
                        id: 'duplicate',
                        label: t('common.duplicate', 'Duplicate'),
                        onSelect: () => {
                          router.push(
                            `${INSURANCE_DESK_BASE}/policies/create?duplicateFrom=${encodeURIComponent(row.id)}`,
                          )
                        },
                      },
                      {
                        id: 'delete',
                        label: t('common.delete', 'Delete'),
                        destructive: true,
                        onSelect: async () => {
                          const name =
                            row.policyNumber?.trim() ||
                            t('insurance_desk.policies.list.deleteFallbackName', 'this policy')
                          const ok = await confirm({
                            title: t(
                              'insurance_desk.policies.list.deleteConfirm',
                              'Are you sure you want to delete policy {{name}}? This action cannot be undone.',
                              { name },
                            ),
                            variant: 'destructive',
                          })
                          if (!ok) return
                          try {
                            await deleteCrud('insurance/policies', row.id, {
                              errorMessage: t(
                                'insurance_desk.policies.deleteError',
                                'Could not delete policy.',
                              ),
                            })
                            flash(t('insurance_desk.policies.deletedFlash', 'Policy removed.'), 'success')
                            setReloadToken((n) => n + 1)
                          } catch (err) {
                            const message =
                              err instanceof Error
                                ? err.message
                                : t('insurance_desk.policies.deleteError', 'Could not delete policy.')
                            flash(message, 'error')
                          }
                        },
                      },
                    ]}
                  />
                )
              : undefined
          }
        />
        {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}
