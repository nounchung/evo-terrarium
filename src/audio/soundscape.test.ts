import { describe, expect, it } from 'vitest'
import { SimulationEngine } from '../simulation/engine'
import { soundscapeProfile } from './soundscape'

describe('procedural soundscape profile', () => {
  it('derives bounded layers from the living world', () => {
    const world = new SimulationEngine('SOUND-2207').snapshot()
    const profile = soundscapeProfile(world)

    expect(profile.water).toBeGreaterThan(0.1)
    expect(profile.life).toBeGreaterThan(0)
    expect(Object.values(profile).every((value) => value >= 0 && value <= 1)).toBe(true)
  })

  it('raises tension when an active disaster is present', () => {
    const engine = new SimulationEngine('SOUND-9912')
    const before = soundscapeProfile(engine.snapshot())
    engine.applyWorldAction('wildfire', 720, 450, 110)
    const after = soundscapeProfile(engine.snapshot())

    expect(after.tension).toBeGreaterThan(before.tension)
  })
})
