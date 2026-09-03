"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { CrudForm } from '@open-mercato/ui/backend/CrudForm'
import { updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { TAXI_FLEET_BASE } from '../../backend/taxi-fleet/paths'
import { StaffTeamMemberPreview } from '../StaffTeamMemberPreview'
import {
  buildDriverProfileFormFields,
  buildDriverProfileFormGroups,
  driverProfileFormValuesToUpdatePayload,
  driverProfileUpdateSchema,
  type DriverProfileUpdateFormValues,
} from '../driverProfileFormConfig'

type DriverProfileBasicsPanelProps = {
  profileId: string
  initialValues: DriverProfileUpdateFormValues
  teamMemberId: string
  memberDisplayName: string
  readOnly: boolean
  onSaved: () => void
  onDeleted: () => void
}

export function DriverProfileBasicsPanel({
  profileId,
  initialValues,
  teamMemberId,
  memberDisplayName,
  readOnly,
  onSaved,
  onDeleted,
}: DriverProfileBasicsPanelProps) {
  const t = useT()
  const router = useRouter()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [formKey, setFormKey] = React.useState(0)

  const fields = React.useMemo(
    () => buildDriverProfileFormFields(t, { mode: 'edit', readOnly, surface: 'sidebar' }),
    [readOnly, t],
  )
  const groups = React.useMemo(() => buildDriverProfileFormGroups(t), [t])

  const handleDelete = React.useCallback(async () => {
    const ok = await confirm({
      title: t('taxi_fleet.drivers.list.deleteConfirm', 'Delete this driver profile?'),
      variant: 'destructive',
    })
    if (!ok) return
    await deleteCrud('taxi_fleet/driver-profiles', profileId, {
      errorMessage: t('taxi_fleet.drivers.list.deleteError', 'Failed to delete driver profile.'),
    })
    flash(t('taxi_fleet.drivers.list.deleteSuccess', 'Driver profile deleted.'), 'success')
    onDeleted()
    router.push(`${TAXI_FLEET_BASE}/drivers`)
  }, [confirm, onDeleted, profileId, router, t])

  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <h2 className="text-sm font-semibold">{t('taxi_fleet.drivers.form.groups.basics', 'Basics')}</h2>
      <div className="mt-3">
        <StaffTeamMemberPreview teamMemberId={teamMemberId} displayName={memberDisplayName} />
      </div>
      <div className="mt-4 border-t border-border/70 pt-4 [&_.grid>div:nth-child(1)]:md:col-span-2 [&_.grid>div:nth-child(2)]:md:col-span-4">
        <CrudForm<DriverProfileUpdateFormValues>
          key={formKey}
          embedded
          fields={fields}
          groups={groups}
          initialValues={initialValues}
          schema={driverProfileUpdateSchema() as z.ZodType<DriverProfileUpdateFormValues>}
          readOnly={readOnly}
          submitLabel={t('taxi_fleet.drivers.form.save', 'Save changes')}
          onDelete={readOnly ? undefined : handleDelete}
          onSubmit={async (values) => {
            await updateCrud(
              'taxi_fleet/driver-profiles',
              driverProfileFormValuesToUpdatePayload(profileId, values),
              { errorMessage: t('taxi_fleet.drivers.form.saveError', 'Could not save driver profile.') },
            )
            flash(t('taxi_fleet.drivers.form.updated', 'Changes saved.'), 'success')
            setFormKey((value) => value + 1)
            onSaved()
          }}
        />
      </div>
      {ConfirmDialogElement}
    </div>
  )
}
