"use client"

import * as React from 'react'
import { format } from 'date-fns'
import { Plus } from 'lucide-react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import type { ScheduleRange, ScheduleViewMode } from '@open-mercato/ui/backend/schedule'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import {
  AllocationCalendar,
  createDefaultAllocationWeekRange,
  formatAllocationRangeQuery,
} from '../AllocationCalendar'
import type { CalendarAssignment } from '../../lib/calendarScheduleItems'
import { AllocationEditDialog, type AllocationEditSeed } from '../AllocationEditDialog'
import { useTaxiFleetLabels } from '../useTaxiFleetLabels'

type AssignmentsResponse = { items: CalendarAssignment[] }

type DriverAllocationsTabProps = {
  teamMemberId: string
  defaultResourceId?: string | null
  resolveDriverName: (teamMemberId: string) => string
  resolveResourceLabel: (resourceId: string) => string
  canManageAssignments: boolean
}

export function DriverAllocationsTab({
  teamMemberId,
  defaultResourceId,
  resolveDriverName,
  resolveResourceLabel,
  canManageAssignments,
}: DriverAllocationsTabProps) {
  const t = useT()
  const { resolveTripTypeLabel } = useTaxiFleetLabels()
  const scopeVersion = useOrganizationScopeVersion()
  const [view, setView] = React.useState<ScheduleViewMode>('week')
  const [range, setRange] = React.useState<ScheduleRange>(() => createDefaultAllocationWeekRange())
  const [assignments, setAssignments] = React.useState<CalendarAssignment[]>([])
  const [reloadToken, setReloadToken] = React.useState(0)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [dialogSeed, setDialogSeed] = React.useState<AllocationEditSeed | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      const { dateFrom, dateTo } = formatAllocationRangeQuery(range)
      const params = new URLSearchParams({
        page: '1',
        pageSize: '500',
        dateFrom,
        dateTo,
        teamMemberId,
      })
      const call = await apiCall<AssignmentsResponse>(`/api/taxi_fleet/assignments?${params}`)
      if (cancelled) return
      setAssignments(Array.isArray(call.result?.items) ? call.result.items : [])
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [range, reloadToken, scopeVersion, teamMemberId])

  const resolvers = React.useMemo(
    () => ({
      resolveDriverName,
      resolveResourceLabel,
      resolveTripTypeLabel,
    }),
    [resolveDriverName, resolveResourceLabel, resolveTripTypeLabel],
  )

  const openCreate = React.useCallback((seed: AllocationEditSeed) => {
    setDialogSeed(seed)
    setDialogOpen(true)
  }, [])

  return (
    <div className="space-y-4">
      {canManageAssignments ? (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            className="inline-flex items-center gap-2"
            onClick={() => openCreate({ assignmentDate: format(new Date(), 'yyyy-MM-dd') })}
          >
            <Plus className="size-4 shrink-0" aria-hidden />
            {t('taxi_fleet.allocations.actions.new', 'New allocation')}
          </Button>
        </div>
      ) : null}
      <AllocationCalendar
        assignments={assignments}
        resolvers={resolvers}
        view={view}
        range={range}
        onRangeChange={setRange}
        onViewChange={setView}
        onAssignmentClick={(assignment) => {
          if (!canManageAssignments) return
          openCreate({
            id: assignment.id,
            assignmentDate: assignment.assignmentDate,
            plannedShiftStart: assignment.plannedShiftStart
              ? new Date(assignment.plannedShiftStart)
              : assignment.shiftStart
                ? new Date(assignment.shiftStart)
                : null,
            plannedShiftEnd: assignment.plannedShiftEnd
              ? new Date(assignment.plannedShiftEnd)
              : assignment.shiftEnd
                ? new Date(assignment.shiftEnd)
                : null,
            actualShiftStart: assignment.shiftStart ? new Date(assignment.shiftStart) : null,
            actualShiftEnd: assignment.shiftEnd ? new Date(assignment.shiftEnd) : null,
            status: assignment.status,
            resourceId: assignment.resourceId,
          })
        }}
        onSlotClick={(seed) => {
          if (!canManageAssignments) return
          openCreate(seed)
        }}
      />
      <AllocationEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        teamMemberId={teamMemberId}
        defaultResourceId={defaultResourceId}
        seed={dialogSeed}
        onSaved={() => setReloadToken((value) => value + 1)}
      />
    </div>
  )
}
