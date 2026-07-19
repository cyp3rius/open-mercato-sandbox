/**
 * @jest-environment node
 */

describe('catalog injection table', () => {
  it('registers default bulk delete actions for catalog product tables', async () => {
    const mod = await import('../injection-table')
    const table = mod.injectionTable

    expect(table['data-table:catalog.products:bulk-actions']).toEqual({
      widgetId: 'catalog.injection.product-bulk-delete',
      priority: 40,
    })
    expect(table['data-table:catalog.products.list:bulk-actions']).toEqual({
      widgetId: 'catalog.injection.product-bulk-delete',
      priority: 40,
    })
  })

  it('registers customer offerings tabs on person and company detail', async () => {
    const mod = await import('../injection-table')
    const table = mod.injectionTable
    const expected = [
      {
        widgetId: 'catalog.injection.customer-offerings',
        kind: 'tab',
        groupId: 'catalog-offerings',
        groupLabel: 'catalog.customerOfferings.tabLabel',
        priority: 35,
      },
    ]
    expect(table['customers.person.detail:tabs']).toEqual(expected)
    expect(table['customers.company.detail:tabs']).toEqual(expected)
    expect(table['detail:customers.person:tabs']).toEqual(expected)
    expect(table['detail:customers.company:tabs']).toEqual(expected)
  })
})
