import { applyAutoEndedAtLocal } from '../TripRouteDistanceSync'

describe('applyAutoEndedAtLocal', () => {
  it('sets end from duration when auto-adjust is enabled', () => {
    const updates: Record<string, unknown> = {}
    const applied = applyAutoEndedAtLocal({
      setFormValue: (id, value) => {
        updates[id] = value
      },
      startedAtLocal: '2026-07-18T10:00',
      durationSeconds: 1800,
      autoAdjustEnd: true,
      endedAtManual: false,
    })
    expect(applied).toBe(true)
    expect(updates.endedAtLocal).toBe('2026-07-18T10:30')
  })

  it('falls back to 60 minutes when duration is missing', () => {
    const updates: Record<string, unknown> = {}
    applyAutoEndedAtLocal({
      setFormValue: (id, value) => {
        updates[id] = value
      },
      startedAtLocal: '2026-07-18T10:00',
      durationSeconds: null,
      autoAdjustEnd: true,
      endedAtManual: false,
    })
    expect(updates.endedAtLocal).toBe('2026-07-18T11:00')
  })

  it('does not change end when the user set it manually', () => {
    const updates: Record<string, unknown> = {}
    const applied = applyAutoEndedAtLocal({
      setFormValue: (id, value) => {
        updates[id] = value
      },
      startedAtLocal: '2026-07-18T10:00',
      durationSeconds: 1800,
      autoAdjustEnd: true,
      endedAtManual: true,
    })
    expect(applied).toBe(false)
    expect(updates.endedAtLocal).toBeUndefined()
  })

  it('does not change end in edit mode', () => {
    const updates: Record<string, unknown> = {}
    const applied = applyAutoEndedAtLocal({
      setFormValue: (id, value) => {
        updates[id] = value
      },
      startedAtLocal: '2026-07-18T10:00',
      durationSeconds: 1800,
      autoAdjustEnd: false,
      endedAtManual: false,
    })
    expect(applied).toBe(false)
    expect(updates.endedAtLocal).toBeUndefined()
  })
})
