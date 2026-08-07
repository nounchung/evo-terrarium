import { describe, expect, it } from 'vitest'
import { SimulationEngine } from './engine'

describe('SimulationEngine', () => {
  it('creates the same initial world for the same seed', () => {
    const first = new SimulationEngine('MOSS-1738').snapshot()
    const second = new SimulationEngine('MOSS-1738').snapshot()

    expect(first.terrain).toEqual(second.terrain)
    expect(first.creatures.slice(0, 10)).toEqual(second.creatures.slice(0, 10))
    expect(first.plants.slice(0, 10)).toEqual(second.plants.slice(0, 10))
  })

  it('keeps the ecosystem bounded during a long simulated run', () => {
    const engine = new SimulationEngine('STABILITY-2048')

    for (let step = 0; step < 12_000; step += 1) engine.step(0.1)
    const world = engine.snapshot()

    expect(world.tick).toBe(12_000)
    expect(world.creatures.length).toBeLessThanOrEqual(240)
    expect(world.plants.length).toBeLessThanOrEqual(260)
    expect(world.creatures.every((creature) => Number.isFinite(creature.x + creature.y))).toBe(true)
    expect(world.stats.births).toBeGreaterThan(0)
  }, 15_000)

  it('serializes and restores a world without losing entities or lineage', () => {
    const original = new SimulationEngine('RESTORE-4821')
    for (let step = 0; step < 400; step += 1) original.step(0.05)
    const saved = original.snapshot()
    const restored = new SimulationEngine(saved.seed, saved).snapshot()

    expect(restored).toEqual(saved)
    expect(JSON.parse(JSON.stringify(restored))).toEqual(saved)
  })

  it('applies player terrain and creature actions', () => {
    const engine = new SimulationEngine('CREATOR-1001')
    const before = engine.snapshot()
    const landCreature = before.creatures[0]

    engine.applyWorldAction('water', landCreature.x, landCreature.y, 70)
    engine.applyWorldAction('grazer', before.creatures[1].x, before.creatures[1].y)
    const after = engine.snapshot()

    expect(after.terrainRevision).toBe(before.terrainRevision + 1)
    expect(after.stats.grazers).toBe(before.stats.grazers + 1)
  })
})

