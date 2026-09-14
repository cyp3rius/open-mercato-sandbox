import type { CommandRuntimeContext } from '@open-mercato/shared/lib/commands'
import type { TranslateFn } from '@open-mercato/shared/lib/api/scoped'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { resolveOrCreateContactPerson } from '../../insurance_desk/lib/resolveContactPerson'
import { normalizeDriverCustomerPhone } from './driverCustomerPhone'
import type { TripCustomerLink } from './customerLink'

function splitPhoneAsDisplayName(phone: string): { firstName: string; lastName: string; displayName: string } {
  // Match driver app: single-token name uses the phone for both parts so CRM stays searchable.
  return { firstName: phone, lastName: phone, displayName: phone }
}

/**
 * Find or create a CRM person from a phone (driver-app normalization: PL national → +48…).
 */
export async function ensureTripCustomerPersonFromPhone(
  ctx: CommandRuntimeContext,
  translate: TranslateFn,
  params: {
    organizationId: string
    tenantId: string
    primaryPhone: string
    displayName?: string | null
    source?: string
  },
): Promise<TripCustomerLink> {
  const phone = normalizeDriverCustomerPhone(params.primaryPhone)
  if (!phone) {
    throw new CrudHttpError(400, {
      error: translate(
        'taxi_fleet.trips.errors.customerPhoneInvalid',
        'Enter a valid phone number (e.g. 504 013 184 or +48 504 013 184).',
      ),
    })
  }

  const nameRaw = params.displayName?.trim() || phone
  const names =
    nameRaw === phone
      ? splitPhoneAsDisplayName(phone)
      : (() => {
          const parts = nameRaw.replace(/\s+/g, ' ').split(' ').filter(Boolean)
          if (parts.length >= 2) {
            return {
              firstName: parts[0]!,
              lastName: parts.slice(1).join(' '),
              displayName: nameRaw,
            }
          }
          return { firstName: nameRaw, lastName: nameRaw, displayName: nameRaw }
        })()

  const personEntityId = await resolveOrCreateContactPerson(ctx, translate, {
    organizationId: params.organizationId,
    tenantId: params.tenantId,
    personFields: {
      firstName: names.firstName,
      lastName: names.lastName,
      displayName: names.displayName,
      primaryPhone: phone,
      source: params.source ?? 'taxi_fleet_crm_trip',
      crmRecordType: 'customer',
    },
  })

  if (!personEntityId) {
    throw new CrudHttpError(400, {
      error: translate(
        'taxi_fleet.trips.errors.customerCreateFailed',
        'Could not create customer from phone number.',
      ),
    })
  }

  return { customerPersonId: personEntityId, customerCompanyId: null }
}
