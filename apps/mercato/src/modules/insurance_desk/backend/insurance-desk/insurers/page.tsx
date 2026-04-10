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
import { renderDictionaryIcon } from '@open-mercato/core/modules/dictionaries/components/dictionaryAppearance'
import { deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { INSURANCE_DESK_BASE } from '../paths'

const PAGE_SIZE = 20

type StatusDictEntry = { value: string; label: string; icon?: string; color?: string }

type InsurerRow = {
  id: string
  code: string
  name: string
  description: string | null
  status: string
  isActive: boolean
}

type ListResponse = {
  items: InsurerRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function InsuranceInsurersListPage() {
  const router = useRouter()
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [rows, setRows] = React.useState<InsurerRow[]>([])
  const [page, setPage] = React.useState(1)
  const [total, setTotal] = React.useState(0)
  const [totalPages, setTotalPages] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [canManage, setCanManage] = React.useState(false)
  const [reloadToken, setReloadToken] = React.useState(0)
  const [statusDict, setStatusDict] = React.useState<StatusDictEntry[]>([])

  React.useEffect(() => {
    let cancelled = false
    async function loadDict() {
      const call = await apiCall<{ entries?: StatusDictEntry[] }>('/api/insurance/config-insurer-status')
      if (cancelled) return
      setStatusDict(Array.isArray(call.result?.entries) ? call.result.entries : [])
    }
    void loadDict()
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
        body: JSON.stringify({ features: ['insurance.insurers.manage'] }),
      })
      if (cancelled) return
      const granted = Array.isArray(call.result?.granted) ? call.result?.granted : []
      setCanManage(call.result?.ok === true || granted.includes('insurance.insurers.manage'))
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
          search: search.trim(),
        })
        const call = await apiCall<ListResponse>(`/api/insurance/insurers?${params.toString()}`)
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

  const columns = React.useMemo<ColumnDef<InsurerRow>[]>(
    () => [
      {
        id: 'code',
        header: t('insurance_desk.insurers.col.code', 'Code'),
        accessorKey: 'code',
        meta: { truncate: true, maxWidth: 220 },
      },
      {
        id: 'name',
        header: t('insurance_desk.insurers.col.name', 'Name'),
        accessorKey: 'name',
        meta: { truncate: true, maxWidth: 320 },
      },
      {
        id: 'status',
        header: t('insurance_desk.insurers.col.status', 'Status'),
        cell: ({ row }) => {
          const raw = row.original.status?.trim() ?? ''
          if (!raw.length) return '—'
          const entry = statusByValue.get(raw)
          const label = entry?.label ?? raw
          const icon = entry?.icon?.trim()
          const color = entry?.color?.trim()
          return (
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
        },
        meta: { truncate: true, maxWidth: 240 },
      },
    ],
    [statusByValue, t],
  )

  return (
    <Page>
      <PageBody>
        <DataTable<InsurerRow>
          title={t('insurance_desk.insurers.title', 'Insurers')}
          entityId="insurance_desk:insurers"
          data={rows}
          columns={columns}
          onRowClick={
            canManage
              ? (row) => {
                  router.push(`${INSURANCE_DESK_BASE}/insurers/${encodeURIComponent(row.id)}`)
                }
              : undefined
          }
          searchValue={search}
          onSearchChange={setSearch}
          isLoading={isLoading}
          actions={
            canManage ? (
              <Button asChild>
                <Link href={`${INSURANCE_DESK_BASE}/insurers/create`}>
                  {t('insurance_desk.insurers.create', 'Add insurer')}
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
                        label: t('insurance_desk.insurers.viewDetails', 'View details'),
                        onSelect: () => {
                          router.push(`${INSURANCE_DESK_BASE}/insurers/${encodeURIComponent(row.id)}`)
                        },
                      },
                      {
                        id: 'duplicate',
                        label: t('common.duplicate', 'Duplicate'),
                        onSelect: () => {
                          router.push(
                            `${INSURANCE_DESK_BASE}/insurers/create?duplicateFrom=${encodeURIComponent(row.id)}`,
                          )
                        },
                      },
                      {
                        id: 'delete',
                        label: t('common.delete', 'Delete'),
                        destructive: true,
                        onSelect: async () => {
                          const code = row.code?.trim() ?? ''
                          const displayName = row.name?.trim() ?? ''
                          const name =
                            code.length && displayName.length
                              ? `${code} — ${displayName}`
                              : displayName || code || t('insurance_desk.insurers.list.deleteFallbackName', 'this insurer')
                          const ok = await confirm({
                            title: t(
                              'insurance_desk.insurers.list.deleteConfirm',
                              'Are you sure you want to delete {{name}}? This action cannot be undone.',
                              { name },
                            ),
                            variant: 'destructive',
                          })
                          if (!ok) return
                          try {
                            await deleteCrud('insurance/insurers', row.id, {
                              errorMessage: t(
                                'insurance_desk.insurers.deleteError',
                                'Could not delete insurer.',
                              ),
                            })
                            flash(t('insurance_desk.insurers.deletedFlash', 'Insurer removed.'), 'success')
                            setReloadToken((n) => n + 1)
                          } catch (err) {
                            const message =
                              err instanceof Error
                                ? err.message
                                : t('insurance_desk.insurers.deleteError', 'Could not delete insurer.')
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
