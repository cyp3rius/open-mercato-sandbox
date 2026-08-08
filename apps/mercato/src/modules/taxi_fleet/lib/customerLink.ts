export type TripCustomerLink = {
  customerPersonId: string | null
  customerCompanyId: string | null
}

export function readTripCustomerEntityId(link: TripCustomerLink): string | null {
  return link.customerPersonId ?? link.customerCompanyId ?? null
}
