import type { MfRegistryCompanyData } from './mfVatRegistry'
import {
  buildBillingAddressCreatePayload,
  buildBillingAddressUpdatePayload,
  findBillingAddressId,
  mfRegistryHasUsableBillingAddress,
  type BillingAddressListItem,
} from './mfRegistryBillingAddress'

export type SyncBillingAddressFromMfRegistryParams = {
  entityId: string
  registry: MfRegistryCompanyData
  organizationId?: string | null
  listAddresses: (entityId: string) => Promise<BillingAddressListItem[]>
  createAddress: (body: Record<string, unknown>) => Promise<void>
  updateAddress: (id: string, patch: Record<string, unknown>) => Promise<void>
}

/**
 * Creates or updates the company's `billing` address from MF VAT whitelist address fields.
 * No-op when the registry payload has no usable street line (`addressLine1`).
 */
export async function syncBillingAddressFromMfRegistry(
  params: SyncBillingAddressFromMfRegistryParams,
): Promise<void> {
  const { entityId, registry, organizationId, listAddresses, createAddress, updateAddress } = params
  if (!mfRegistryHasUsableBillingAddress(registry)) return

  const items = await listAddresses(entityId)
  const billingId = findBillingAddressId(items)
  if (billingId) {
    await updateAddress(billingId, buildBillingAddressUpdatePayload(registry))
    return
  }
  const createBody = buildBillingAddressCreatePayload(entityId, registry, organizationId)
  if (createBody) await createAddress(createBody)
}
