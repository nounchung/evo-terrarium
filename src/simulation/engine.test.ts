import { describe, expect, it } from 'vitest'
import { SimulationEngine } from './engine'
import { isLand } from './terrain'
import type { Creature, WorldState } from './types'

function shorelinePoint(world: WorldState): { x: number; y: number } {
  const offsets = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]
  for (let row = 0; row < world.rows; row += 1) {
    for (let column = 0; column < world.columns; column += 1) {
      const biome = world.terrain[row * world.columns + column]
      if (!isLand(biome)) continue
      const touchesWater = offsets.some(([offsetX, offsetY]) => {
        const nextColumn = column + offsetX
        const nextRow = row + offsetY
        if (
          nextColumn < 0 ||
          nextColumn >= world.columns ||
          nextRow < 0 ||
          nextRow >= world.rows
        ) {
          return false
        }
        return !isLand(world.terrain[nextRow * world.columns + nextColumn])
      })
      if (touchesWater) {
        return {
          x: (column + 0.5) * world.cellSize,
          y: (row + 0.5) * world.cellSize,
        }
      }
    }
  }
  throw new Error('Expected the generated world to include a shoreline')
}

describe('SimulationEngine', () => {
  it('creates the same initial world for the same seed', () => {
    const first = new SimulationEngine('MOSS-1738').snapshot()
    const second = new SimulationEngine('MOSS-1738').snapshot()

    expect(first.terrain).toEqual(second.terrain)
    expect(first.creatures.slice(0, 10)).toEqual(second.creatures.slice(0, 10))
    expect(first.plants.slice(0, 10)).toEqual(second.plants.slice(0, 10))
  })

  it.each(['STABILITY-2048', 'TIDAL-3381', 'FERN-7712'])(
    'keeps the %s food web bounded for twenty simulated minutes',
    (seed) => {
      const engine = new SimulationEngine(seed)

      for (let step = 0; step < 12_000; step += 1) engine.step(0.1)
      const world = engine.snapshot()
      const recordedDeaths = Object.values(world.stats.deathsByCause).reduce(
        (total, count) => total + count,
        0,
      )

      expect(world.tick).toBe(12_000)
      expect(world.creatures.length).toBeLessThanOrEqual(240)
      expect(world.plants.length).toBeLessThanOrEqual(260)
      expect(world.creatures.every((creature) => Number.isFinite(creature.x + creature.y))).toBe(true)
      expect(world.creatures.every((creature) => Number.isFinite(creature.hydration))).toBe(true)
      expect(world.stats.births).toBeGreaterThan(0)
      expect(world.stats.deaths).toBeGreaterThan(0)
      expect(recordedDeaths).toBe(world.stats.deaths)
      expect(world.stats.grazers).toBeGreaterThan(0)
      const hunterHistory = world.deathRecords
        .filter((record) => record.kind === 'hunter')
        .map((record) => ({ generation: record.generation, cause: record.cause, day: record.day }))
      expect(
        world.stats.hunters,
        JSON.stringify({ stats: world.stats, hunterHistory }),
      ).toBeGreaterThan(0)
    },
    30_000,
  )

  it('lets thirsty creatures find and drink from a shoreline', () => {
    const engine = new SimulationEngine('WATER-4821')
    const point = shorelinePoint(engine.state)
    const creature = engine.state.creatures.find((candidate) => candidate.kind === 'grazer') as Creature
    creature.x = point.x
    creature.y = point.y
    creature.targetX = point.x
    creature.targetY = point.y
    creature.hydration = 28
    creature.energy = 90
    creature.decisionTimer = 0
    engine.state.creatures = [creature]

    engine.step(0.1)

    expect(creature.behaviour).toBe('drink')
    expect(creature.hydration).toBeGreaterThan(70)
    expect(creature.drinks).toBe(1)
  })

  it('records an explicit cause when a creature dies', () => {
    const engine = new SimulationEngine('SCARCITY-9921')
    const creature = engine.state.creatures[0]
    creature.energy = 0

    engine.step(0.05)

    expect(engine.state.creatures.some((candidate) => candidate.id === creature.id)).toBe(false)
    expect(engine.state.deathRecords[0]).toMatchObject({
      creatureId: creature.id,
      cause: 'starvation',
    })
    expect(engine.state.stats.deathsByCause.starvation).toBe(1)
  })

  it('serializes and restores a world without losing entities or lineage', () => {
    const original = new SimulationEngine('RESTORE-4821')
    for (let step = 0; step < 400; step += 1) original.step(0.05)
    const saved = original.snapshot()
    const restored = new SimulationEngine(saved.seed, saved).snapshot()

    expect(restored).toEqual(saved)
    expect(JSON.parse(JSON.stringify(restored))).toEqual(saved)
  })

  it('adds R1 lifecycle fields when restoring an R0 snapshot', () => {
    const saved = new SimulationEngine('LEGACY-1180').snapshot()
    type LegacySnapshot = Omit<WorldState, 'creatures' | 'stats' | 'deathRecords' | 'genealogy'> & {
      creatures: Array<Partial<Creature>>
      stats: Partial<WorldState['stats']>
      deathRecords?: WorldState['deathRecords']
      genealogy?: WorldState['genealogy']
    }
    const legacy = structuredClone(saved) as unknown as LegacySnapshot
    delete legacy.deathRecords
    delete legacy.genealogy
    delete legacy.stats.deathsByCause
    delete legacy.stats.averageHydration
    delete legacy.stats.status
    for (const creature of legacy.creatures) {
      delete creature.hydration
      delete creature.attackCooldown
      delete creature.meals
      delete creature.drinks
      delete creature.kills
      delete creature.lastAttackerId
      delete creature.lastAttackTick
      delete creature.bornDay
      delete creature.mutations
    }

    const restored = new SimulationEngine(
      saved.seed,
      legacy as unknown as WorldState,
    ).snapshot()

    expect(restored.creatures[0].hydration).toBe(76)
    expect(restored.creatures[0].drinks).toBe(0)
    expect(restored.deathRecords).toEqual([])
    expect(restored.genealogy).toHaveLength(restored.creatures.length)
    expect(restored.stats.deathsByCause).toEqual({
      predation: 0,
      starvation: 0,
      dehydration: 0,
      age: 0,
    })
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

  it('undoes the most recent creation action without changing the saved baseline', () => {
    const engine = new SimulationEngine('UNDO-4102')
    const before = engine.snapshot()

    engine.applyWorldAction('water', before.creatures[0].x, before.creatures[0].y, 70)

    expect(engine.canUndo()).toBe(true)
    expect(engine.state.terrainRevision).toBe(before.terrainRevision + 1)
    expect(engine.undoWorldAction()).toBe(true)
    expect(engine.snapshot()).toEqual(before)
    expect(engine.canUndo()).toBe(false)
  })

  it('records inherited mutations and persistent multi-generation genealogy', () => {
    const engine = new SimulationEngine('LINEAGE-8824')
    for (let step = 0; step < 6_000; step += 1) engine.step(0.05)
    const world = engine.snapshot()
    const descendants = world.genealogy.filter((record) => record.generation > 1)
    const mutations = descendants.flatMap((record) => record.mutations)

    expect(descendants.length).toBeGreaterThan(0)
    expect(descendants.every((record) => record.parents?.length === 2)).toBe(true)
    expect(mutations.length).toBeGreaterThan(0)
    expect(mutations.every((mutation) => Number.isFinite(mutation.value))).toBe(true)
    expect(world.creatures.every((creature) => {
      const record = world.genealogy.find((entry) => entry.id === creature.id)
      return record?.diedDay === null && record.children.length === creature.children.length
    })).toBe(true)

    const restored = new SimulationEngine(world.seed, world).snapshot()
    expect(restored.genealogy).toEqual(world.genealogy)
  })
})
