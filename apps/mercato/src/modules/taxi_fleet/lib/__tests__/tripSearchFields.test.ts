import {
  buildTripSearchTextLines,
  enrichTripRecordForSearch,
  extractTripSearchFlatFields,
  readTripCustomerEntityId,
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
    })
    expect(lines).toEqual([
      'From: Start',
      'To: End',
      'Stops: Stop 1',
      'Customer: Firma X',
    ])
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
