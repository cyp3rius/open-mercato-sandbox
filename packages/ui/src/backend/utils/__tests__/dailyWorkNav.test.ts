import { findBestSidebarNavMatch, isSidebarNavItemActive } from '../dailyWorkNav'

const fleetSiblings = [
  { href: '/backend/taxi-fleet' },
  { href: '/backend/taxi-fleet/assignments' },
  { href: '/backend/taxi-fleet/trips' },
  { href: '/backend/taxi-fleet/settlements' },
  { href: '/backend/taxi-fleet/drivers' },
]

describe('sidebar nav active matching', () => {
  it('highlights module hub only on exact hub path', () => {
    expect(findBestSidebarNavMatch('/backend/taxi-fleet', fleetSiblings)?.href).toBe('/backend/taxi-fleet')
    expect(isSidebarNavItemActive('/backend/taxi-fleet', '/backend/taxi-fleet', fleetSiblings)).toBe(true)
    expect(isSidebarNavItemActive('/backend/taxi-fleet', '/backend/taxi-fleet/assignments', fleetSiblings)).toBe(false)
  })

  it('prefers deepest child route under module hub', () => {
    const path = '/backend/taxi-fleet/assignments'
    expect(findBestSidebarNavMatch(path, fleetSiblings)?.href).toBe('/backend/taxi-fleet/assignments')
    expect(isSidebarNavItemActive(path, '/backend/taxi-fleet/assignments', fleetSiblings)).toBe(true)
    expect(isSidebarNavItemActive(path, '/backend/taxi-fleet', fleetSiblings)).toBe(false)
  })

  it('matches dashboard href only exactly', () => {
    const siblings = [{ href: '/backend' }, { href: '/backend/messages' }]
    expect(isSidebarNavItemActive('/backend', '/backend', siblings)).toBe(true)
    expect(isSidebarNavItemActive('/backend/messages', '/backend', siblings)).toBe(false)
  })
})
