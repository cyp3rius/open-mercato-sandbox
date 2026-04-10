"use client"

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BadgeCheck } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { INSURANCE_DESK_BASE } from '../paths'
import { renderDictionaryIcon } from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'

const PAGE_SIZE = 20

type LeadRow = {
  id: string
  title: string
  status: string
  source: string | null
  externalId: string | null
  payload: Record<string, unknown> | null
  referringPartnerEntityId: string | null
  linkedPolicyId: string | null
  createdAt: string | null
}

type ListResponse = {
  items: LeadRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

type LeadStatusDictEntry = { value: string; label: string; icon?: string; color?: string }

function shortId(value: string | null, len = 10) {
  if (!value) return '—'
  return value.length > len ? `${value.slice(0, len)}…` : value
}

export default function InsuranceLeadsPage() {
  const t = useT()
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const scopeVersion = useOrganizationScopeVersion()
  const [rows, setRows] = React.useState<LeadRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [canManageLeads, setCanManageLeads] = React.useState(false)
  const [canViewLeads, setCanViewLeads] = React.useState(false)
  const [canCreatePolicy, setCanCreatePolicy] = React.useState(false)
  const [reloadToken, setReloadToken] = React.useState(0)
  const [leadStatusEntries, setLeadStatusEntries] = React.useState<LeadStatusDictEntry[]>([])

  const leadStatusLabel = React.useCallback(
    (value: string) => {
      const hit = leadStatusEntries.find((e) => e.value === value)
      return hit?.label ?? value
    },
    [leadStatusEntries],
  )

  const leadStatusByValue = React.useMemo(() => {
    const m = new Map<string, LeadStatusDictEntry>()
    for (const e of leadStatusEntries) {
      if (e.value.trim().length) m.set(e.value.trim(), e)
    }
    return m
  }, [leadStatusEntries])

  React.useEffect(() => {
    let cancelled = false
    void apiCall<{ entries?: LeadStatusDictEntry[] }>('/api/insurance/config-lead-status').then((call) => {
      if (cancelled) return
      const entries = Array.isArray(call.result?.entries) ? call.result.entries : []
      setLeadStatusEntries(entries)
    })
    return () => {
      cancelled = true
    }
  }, [scopeVersion])

  React.useEffect(() => {
    let cancelled = false
    async function loadPerm() {
      const call = await apiCall<{ granted?: string[]; ok?: boolean }>('/api/auth/feature-check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          features: ['insurance.leads.view', 'insurance.leads.manage', 'insurance.policies.manage'],
        }),
      })
      if (cancelled) return
      const granted = Array.isArray(call.result?.granted) ? call.result?.granted : []
      setCanViewLeads(granted.includes('insurance.leads.view'))
      setCanManageLeads(call.result?.ok === true || granted.includes('insurance.leads.manage'))
      setCanCreatePolicy(granted.includes('insurance.policies.manage'))
    }
    loadPerm()
    return () => {
      cancelled = true
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setIsLoading(true)
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
          sortField: 'createdAt',
          sortDir: 'desc',
        })
        const q = search.trim()
        if (q.length) params.set('search', q)
        const call = await apiCall<ListResponse>(`/api/insurance/leads?${params.toString()}`)
        if (cancelled) return
        if (!call.ok || !call.result) {
          setRows([])
          setTotal(0)
          setTotalPages(1)
          return
        }
        setRows(Array.isArray(call.result.items) ? call.result.items : [])
        setTotal(typeof call.result.total === 'number' ? call.result.total : 0)
        setTotalPages(typeof call.result.totalPages === 'number' ? call.result.totalPages : 1)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [page, reloadToken, search, scopeVersion])

  const columns = React.useMemo<ColumnDef<LeadRow>[]>(
    () => [
      {
        id: 'title',
        accessorKey: 'title',
        header: t('insurance_desk.leads.col.title', 'Subject'),
        cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: t('insurance_desk.leads.col.status', 'Status'),
        cell: ({ row }) => {
          const raw = row.original.status?.trim() ?? ''
          if (!raw.length) return '—'
          const entry = leadStatusByValue.get(raw)
          const label = entry?.label ?? leadStatusLabel(raw)
          const icon = entry?.icon?.trim()
          const color = entry?.color?.trim()
          return (
            <span className="inline-flex items-center gap-2">
              {icon ? (
                <span className="shrink-0 text-muted-foreground">{renderDictionaryIcon(icon, 'h-4 w-4')}</span>
              ) : null}
              {color ? (
                <span
                  className="inline-block size-2.5 shrink-0 rounded-full border border-border"
                  style={{ backgroundColor: color }}
                />
              ) : null}
              <span className="truncate">{label}</span>
            </span>
          )
        },
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: t('insurance_desk.leads.col.created', 'Received'),
        cell: ({ row }) => {
          const raw = row.original.createdAt
          if (!raw) return '—'
          try {
            return new Date(raw).toLocaleString()
          } catch {
            return raw
          }
        },
      },
      {
        id: 'policy',
        header: t('insurance_desk.leads.col.policy', 'Policy'),
        cell: ({ row }) => {
          const pid = row.original.linkedPolicyId
          if (!pid) return <span className="text-muted-foreground">—</span>
          const href = `${INSURANCE_DESK_BASE}/policies/${encodeURIComponent(pid)}`
          return (
            <Button type="button" variant="outline" size="sm" className="h-8" asChild>
              <Link
                href={href}
                className="inline-flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
              >
                <BadgeCheck className="size-4 shrink-0" aria-hidden />
                {t('insurance_desk.leads.openPolicy', 'Open')}
              </Link>
            </Button>
          )
        },
      },
    ],
    [leadStatusByValue, leadStatusLabel, t],
  )

  return (
    <Page>
      <PageBody>
        {ConfirmDialogElement}
        <DataTable<LeadRow>
          title={t('insurance_desk.leads.title', 'Inquiries')}
          entityId="insurance_desk:leads"
          data={rows}
          columns={columns}
          onRowClick={
            canViewLeads || canManageLeads
              ? (row) => {
                  router.push(`${INSURANCE_DESK_BASE}/leads/${encodeURIComponent(row.id)}`)
                }
              : undefined
          }
          actions={
            canManageLeads ? (
              <Button asChild>
                <Link href={`${INSURANCE_DESK_BASE}/leads/create`}>{t('insurance_desk.leads.add', 'Add inquiry')}</Link>
              </Button>
            ) : null
          }
          searchValue={search}
          onSearchChange={(value) => {
            setPage(1)
            setSearch(value)
          }}
          isLoading={isLoading}
          pagination={{
            page,
            pageSize: PAGE_SIZE,
            total,
            totalPages,
            onPageChange: setPage,
          }}
          rowActions={(row) => (
            <RowActions
              items={[
                ...(canManageLeads
                  ? [
                      {
                        id: 'viewDetails',
                        label: t('insurance_desk.leads.viewDetails', 'View details'),
                        onSelect: () => {
                          router.push(`${INSURANCE_DESK_BASE}/leads/${encodeURIComponent(row.id)}`)
                        },
                      },
                      {
                        id: 'duplicate',
                        label: t('common.duplicate', 'Duplicate'),
                        onSelect: () => {
                          router.push(
                            `${INSURANCE_DESK_BASE}/leads/create?duplicateFrom=${encodeURIComponent(row.id)}`,
                          )
                        },
                      },
                      ...(!row.linkedPolicyId
                        ? [
                            {
                              id: 'delete',
                              label: t('common.delete', 'Delete'),
                              destructive: true,
                              onSelect: async () => {
                                const name =
                                  row.title?.trim() ||
                                  t('insurance_desk.leads.list.deleteFallbackName', 'this inquiry')
                                const ok = await confirm({
                                  title: t(
                                    'insurance_desk.leads.list.deleteConfirm',
                                    'Are you sure you want to delete {{name}}? This action cannot be undone.',
                                    { name },
                                  ),
                                  variant: 'destructive',
                                })
                                if (!ok) return
                                try {
                                  await deleteCrud('insurance/leads', row.id, {
                                    errorMessage: t(
                                      'insurance_desk.leads.deleteError',
                                      'Could not delete inquiry.',
                                    ),
                                  })
                                  flash(t('insurance_desk.leads.deletedFlash', 'Inquiry removed.'), 'success')
                                  setReloadToken((n) => n + 1)
                                } catch (err) {
                                  const message =
                                    err instanceof Error
                                      ? err.message
                                      : t('insurance_desk.leads.deleteError', 'Could not delete inquiry.')
                                  flash(message, 'error')
                                }
                              },
                            },
                          ]
                        : []),
                    ]
                  : []),
                ...(canCreatePolicy && !row.linkedPolicyId
                  ? [
                      {
                        id: 'generatePolicy',
                        label: t('insurance_desk.leads.generatePolicy', 'Generate policy'),
                        onSelect: () => {
                          router.push(`${INSURANCE_DESK_BASE}/policies/create?leadId=${encodeURIComponent(row.id)}`)
                        },
                      },
                    ]
                  : []),
              ]}
            />
          )}
        />
      </PageBody>
    </Page>
  )
}
