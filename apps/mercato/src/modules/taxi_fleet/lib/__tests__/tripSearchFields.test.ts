import {
  buildTripSearchTextLines,
  enrichTripRecordForSearch,
  extractTripSearchFlatFields,
  readTripCustomerEntityId,
  readTripOrderingPersonId,
} from '../tripSearchFields'
import { intersectIdLists, mergeIdFilter } from '../tripListSearch'

describe('tripSearchFields', () => {
  it('extracts addresses and contact labels from tripRequest metadata', () => {
    const flat = extractTripSearchFlatFields(
      {
        metadata: {
          tripRequest: {
            fromAddress: 'Warszawa Centralna',
            toAddress: 'Okęcie',
            waypointAddresses: 'Mokotów\nWola',
            contactName: 'Jan Kowalski',
            companyName: 'ACME Sp. z o.o.',
          },
        },
        customerPersonId: 'person-1',
      },
      'Jan Kowalski CRM',
    )

    expect(flat.fromAddress).toBe('Warszawa Centralna')
    expect(flat.toAddress).toBe('Okęcie')
    expect(flat.waypointAddresses).toContain('Mokotów')
    expect(flat.contactName).toBe('Jan Kowalski')
    expect(flat.companyName).toBe('ACME Sp. z o.o.')
    expect(flat.customerDisplayName).toBe('Jan Kowalski CRM')
  })

  it('enriches top-level searchable fields on the record', () => {
    const record: Record<string, unknown> = {
      metadata: {
        tripRequest: {
          fromAddress: 'A',
          toAddress: 'B',
        },
      },
    }
    enrichTripRecordForSearch(record, 'Klient')
    expect(record.fromAddress).toBe('A')
    expect(record.toAddress).toBe('B')
    expect(record.customerDisplayName).toBe('Klient')
  })

  it('builds searchable text lines for vector indexing', () => {
    const lines = buildTripSearchTextLines({
      fromAddress: 'Start',
      toAddress: 'End',
      waypointAddresses: 'Stop 1',
      contactName: '',
      companyName: '',
      customerDisplayName: 'Firma X',
      orderingPersonDisplayName: 'Jan Kowalski',
      customerPhone: '500600700',
      customerNip: '5252445767',
      customerPersonName: '',
      orderingPersonPhone: '501502503',
      orderingPersonPersonName: 'Jan Kowalski',
    })
    expect(lines).toEqual([
      'From: Start',
      'To: End',
      'Stops: Stop 1',
      'Customer: Firma X',
      'Customer phone: 500600700',
      'Customer NIP: 5252445767',
      'Ordering party: Jan Kowalski',
      'Ordering person: Jan Kowalski',
      'Ordering phone: 501502503',
    ])
  })

  it('uses enrichment object for customer phone and NIP', () => {
    const flat = extractTripSearchFlatFields(
      { customerCompanyId: 'c1' },
      {
        displayName: 'ACME',
        phone: '111',
        nip: '5252445767',
        personName: '',
      },
      {
        displayName: 'Anna Nowak',
        phone: '222',
        nip: '',
        personName: 'Anna Nowak',
      },
    )
    expect(flat.customerDisplayName).toBe('ACME')
    expect(flat.customerPhone).toBe('111')
    expect(flat.customerNip).toBe('5252445767')
    expect(flat.orderingPersonDisplayName).toBe('Anna Nowak')
    expect(flat.orderingPersonPhone).toBe('222')
  })

  it('reads ordering person id from camelCase or snake_case', () => {
    expect(readTripOrderingPersonId({ orderingPersonId: 'op1' })).toBe('op1')
    expect(readTripOrderingPersonId({ ordering_person_id: 'op2' })).toBe('op2')
  })

  it('prefers person id over company id for customer entity resolution', () => {
    expect(
      readTripCustomerEntityId({
        customerPersonId: 'p1',
        customerCompanyId: 'c1',
      }),
    ).toBe('p1')
    expect(readTripCustomerEntityId({ customer_company_id: 'c2' })).toBe('c2')
  })
})

describe('tripListSearch id helpers', () => {
  it('intersects id lists', () => {
    expect(intersectIdLists(['a', 'b', 'c'], ['b', 'c', 'd'])).toEqual(['b', 'c'])
    expect(intersectIdLists([], ['a'])).toEqual([])
    expect(intersectIdLists(['a'], [])).toEqual([])
  })

  it('merges existing ids with search hits', () => {
    expect(mergeIdFilter(undefined, ['a', 'b'])).toEqual(['a', 'b'])
    expect(mergeIdFilter([], ['a', 'b'])).toEqual(['a', 'b'])
    expect(mergeIdFilter(['a', 'c'], ['a', 'b'])).toEqual(['a'])
    expect(mergeIdFilter(['x'], ['a', 'b'])).toEqual([])
  })
})
