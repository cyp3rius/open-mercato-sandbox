import { inputIncludesHouseNumber } from '../route/openRouteService'

describe('inputIncludesHouseNumber', () => {
  it('detects trailing house numbers', () => {
    expect(inputIncludesHouseNumber('Adama Prażmowskiego 46')).toBe(true)
    expect(inputIncludesHouseNumber('ul. Długa 12A')).toBe(true)
    expect(inputIncludesHouseNumber('Marszałkowska 3/4')).toBe(true)
    expect(inputIncludesHouseNumber('  Krakowska 9b ')).toBe(true)
  })

  it('ignores street-only queries', () => {
    expect(inputIncludesHouseNumber('Adama Prażmowskiego')).toBe(false)
    expect(inputIncludesHouseNumber('Warszawa')).toBe(false)
    expect(inputIncludesHouseNumber('Lotnisko Chopina')).toBe(false)
  })
})
