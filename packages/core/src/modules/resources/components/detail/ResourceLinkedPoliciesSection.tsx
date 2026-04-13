"use client"

import * as React from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { formatDateTime } from '@open-mercato/shared/lib/time'
import { Button } from '@open-mercato/ui/primitives/button'

const INSURANCE_DESK_POLICY_PATH = "/backend/insurance-desk/policies"

type PolicyListItem = {
  id: string
  policyNumber: string
  insurerId: string
  status: string | null
  validFrom: string | null
  validTo: string | null
}

type PolicyDisplayRow = PolicyListItem & {
  insurerName: string | null
}

export function ResourceLinkedPoliciesSection({ resourceId }: { resourceId: string | null }) {
  const t = useT()
  const [rows, setRows] = React.useState<PolicyDisplayRow[] | null>(null)

  React.useEffect(() => {
    if (!resourceId) {
      setRows(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const params = new URLSearchParams({
          resourceId,
          page: "1",
          pageSize: "20",
          sortField: "validFrom",
          sortDir: "desc",
        })
        const call = await apiCall<{ items?: PolicyListItem[] }>(`/api/insurance/policies?${params.toString()}`)
        if (cancelled) return
        if (!call.ok || !call.result) {
          setRows(null)
          return
        }
        const items = Array.isArray(call.result.items) ? call.result.items : []
        if (items.length === 0) {
          setRows([])
          return
        }
        const insurerIds = [...new Set(items.map((item) => item.insurerId).filter(Boolean))]
        const insurerNameById = new Map<string, string>()
        await Promise.all(
          insurerIds.map(async (insurerId) => {
            try {
              const ins = await apiCall<{ items?: Array<{ id?: string; name?: string }> }>(
                `/api/insurance/insurers?id=${encodeURIComponent(insurerId)}&page=1&pageSize=1`,
              )
              const first =
                ins.ok && ins.result && Array.isArray(ins.result.items) ? ins.result.items[0] : null
              const name = typeof first?.name === "string" && first.name.trim().length ? first.name.trim() : null
              if (name) insurerNameById.set(insurerId, name)
            } catch {
              /* insurer label optional */
            }
          }),
        )
        if (cancelled) return
        setRows(
          items.map((item) => ({
            ...item,
            insurerName: insurerNameById.get(item.insurerId) ?? null,
          })),
        )
      } catch {
        if (!cancelled) setRows(null)
      }
    })().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [resourceId])

  if (rows === null || rows.length === 0) {
    return null
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/15 p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {rows.length > 1
            ? t("resources.resources.detail.linkedPolicy.sectionTitlePlural", "Insurance policies")
            : t("resources.resources.detail.linkedPolicy.sectionTitle", "Insurance policy")}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {t(
            "resources.resources.detail.linkedPolicy.readOnlyHint",
            "Shown for reference only. Edit the policy in Insurance desk.",
          )}
        </p>
      </div>
      <ul className="space-y-4">
        {rows.map((row) => (
          <li
            key={row.id}
            className="relative rounded-md border border-border/50 bg-background/80 px-3 py-3 text-sm"
          >
            <Button
              type="button"
              variant="outline"
              size="sm"
              asChild
              className="absolute end-3 top-3 z-10 shrink-0"
            >
              <Link
                href={`${INSURANCE_DESK_POLICY_PATH}/${encodeURIComponent(row.id)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2"
              >
                <ExternalLink className="size-4 shrink-0" aria-hidden />
                {t("common.open", "Open")}
              </Link>
            </Button>
            <div className="min-w-0 space-y-1 pe-28">
              <div className="font-semibold text-foreground">{row.policyNumber}</div>
              {row.insurerName ? (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">
                    {t("resources.resources.detail.linkedPolicy.insurer", "Insurer")}
                    {": "}
                  </span>
                  {row.insurerName}
                </div>
              ) : null}
              {row.status ? (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/80">
                    {t("resources.resources.detail.linkedPolicy.status", "Status")}
                    {": "}
                  </span>
                  {row.status}
                </div>
              ) : null}
              <div className="text-xs text-muted-foreground tabular-nums">
                <span className="font-medium text-foreground/80">
                  {t("resources.resources.detail.linkedPolicy.validity", "Validity")}
                  {": "}
                </span>
                {row.validFrom || row.validTo ? (
                  <>
                    {row.validFrom ? formatDateTime(row.validFrom) ?? row.validFrom : "—"}
                    {" — "}
                    {row.validTo ? formatDateTime(row.validTo) ?? row.validTo : "—"}
                  </>
                ) : (
                  "—"
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
