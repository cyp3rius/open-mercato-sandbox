'use client'

import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import type { FleetDriverProfile } from './useFleetDriverDirectory'
import { taxiFleetDialogCrudTabbedBodyClass } from './TaxiFleetDialogShell'
import {
  buildTripFormFields,
  buildTripFormGroups,
  isTripFormSubmittable,
  tripFormSchema,
  TRIP_FORM_SYNC_GROUP_ID,
  type TripFormValues,
} from './tripFormConfig'
import { tripFormTabGroupId, type TripFormTabId } from './TripFormTabNav'

export type TripCrudFormLayout = 'page' | 'dialog'

export type TripCrudFormSharedOptions = {
  mode: 'create' | 'edit'
  driverProfiles: FleetDriverProfile[]
  resolveDriverName: (teamMemberId: string) => string
  driverLocked?: boolean
  lockedTeamMemberId?: string | null
  onAssignmentResolved?: (assignmentId: string | null) => void
  statusOptions?: Array<{ value: string; label: string }>
  readOnly?: boolean
  lockStatus?: string | null
  allowDriverEdit?: boolean
}

type TripCrudFormBaseProps = TripCrudFormSharedOptions & {
  initialValues: TripFormValues
  onSubmit: (values: TripFormValues) => Promise<void>
  formKey?: React.Key
  submitLabel: string
  extraActions?: React.ReactNode
  /** Rendered in CrudForm column 2 (sidebar), below status/pricing groups. */
  sidebarExtra?: React.ReactNode
  onSubmitReadyChange?: (ready: boolean) => void
}

type TripCrudFormPageProps = TripCrudFormBaseProps & {
  layout: 'page'
  title?: string
  backHref?: string
  cancelHref?: string
  onDelete?: () => void
}

type TripCrudFormDialogProps = TripCrudFormBaseProps & {
  layout: 'dialog'
  activeTab?: TripFormTabId
}

export type TripCrudFormProps = TripCrudFormPageProps | TripCrudFormDialogProps

export function TripCrudForm(props: TripCrudFormProps) {
  const t = useT()
  const {
    layout,
    mode,
    initialValues,
    onSubmit,
    formKey,
    submitLabel,
    extraActions,
    sidebarExtra,
    onSubmitReadyChange,
    driverProfiles,
    resolveDriverName,
    driverLocked = false,
    lockedTeamMemberId = null,
    onAssignmentResolved,
    statusOptions,
    readOnly = false,
    lockStatus = null,
    allowDriverEdit = false,
  } = props

  const activeTab = layout === 'dialog' ? (props.activeTab ?? 'route') : null

  const fields = React.useMemo(
    () =>
      buildTripFormFields(t, {
        mode,
        surface: layout,
        driverProfiles,
        resolveDriverName,
        driverLocked,
        lockedTeamMemberId,
        onAssignmentResolved,
        statusOptions,
        readOnly,
        lockStatus,
        allowDriverEdit,
      }),
    [
      allowDriverEdit,
      driverLocked,
      driverProfiles,
      layout,
      lockStatus,
      lockedTeamMemberId,
      mode,
      onAssignmentResolved,
      readOnly,
      resolveDriverName,
      statusOptions,
      t,
    ],
  )

  const allGroups = React.useMemo(() => buildTripFormGroups(t, layout, { mode }), [layout, mode, t])

  const groups = React.useMemo(() => {
    const base =
      layout !== 'dialog' || !activeTab
        ? allGroups
        : allGroups.filter(
            (group) =>
              group.id === tripFormTabGroupId(activeTab) || group.id === TRIP_FORM_SYNC_GROUP_ID,
          )
    if (!sidebarExtra || layout !== 'page') return base
    return [
      ...base,
      {
        id: 'trip-sidebar-extra',
        column: 2 as const,
        bare: true,
        component: () => sidebarExtra,
      },
    ]
  }, [activeTab, allGroups, layout, sidebarExtra])

  const enforceMinAdvance = mode === 'create'
  const schema = React.useMemo(
    () => tripFormSchema(t, { enforceMinAdvance }),
    [enforceMinAdvance, t],
  )
  const requireDriver = !(driverLocked && lockedTeamMemberId?.trim().length)

  const resolveSubmittable = React.useCallback(
    (values: TripFormValues) => isTripFormSubmittable(values, t, { requireDriver, enforceMinAdvance }),
    [enforceMinAdvance, requireDriver, t],
  )

  const [canSubmit, setCanSubmit] = React.useState(() => resolveSubmittable(initialValues))

  React.useEffect(() => {
    setCanSubmit(resolveSubmittable(initialValues))
  }, [formKey, initialValues, resolveSubmittable])

  const handleValuesChange = React.useCallback(
    (values: TripFormValues) => {
      const ready = resolveSubmittable(values)
      setCanSubmit(ready)
      onSubmitReadyChange?.(ready)
    },
    [onSubmitReadyChange, resolveSubmittable],
  )

  const submitDisabled = !canSubmit

  const crudFormProps = {
    fields,
    groups,
    initialValues,
    schema,
    submitLabel,
    extraActions,
    readOnly,
    // Completed/cancelled trips must stay viewable (OCR sidebar, scroll) without CrudForm's frosted overlay.
    readOnlyOverlay: readOnly ? (false as const) : undefined,
    submitDisabled,
    onValuesChange: handleValuesChange,
    onSubmit,
  }

  if (layout === 'dialog') {
    return (
      <div className={taxiFleetDialogCrudTabbedBodyClass}>
        <CrudForm<TripFormValues>
          key={formKey}
          embedded
          {...crudFormProps}
        />
      </div>
    )
  }

  const { title, backHref, cancelHref, onDelete } = props

  return (
    <CrudForm<TripFormValues>
      key={formKey}
      title={title}
      backHref={backHref}
      cancelHref={readOnly ? undefined : cancelHref}
      onDelete={onDelete}
      {...crudFormProps}
    />
  )
}
