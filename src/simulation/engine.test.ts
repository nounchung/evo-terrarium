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
    type LegacySnapshot = Omit<WorldState, 'version' | 'creatures' | 'stats' | 'deathRecords' | 'genealogy' | 'species' | 'nextSpeciesId' | 'climate' | 'disasters' | 'groups' | 'territories' | 'migrations' | 'actionLog' | 'landmarks' | 'nextActionId'> & {
      version: number
      creatures: Array<Partial<Creature>>
      stats: Partial<WorldState['stats']>
      deathRecords?: WorldState['deathRecords']
      genealogy?: WorldState['genealogy']
      species?: WorldState['species']
      nextSpeciesId?: number
      climate?: WorldState['climate']
      disasters?: WorldState['disasters']
      groups?: WorldState['groups']
      territories?: WorldState['territories']
      migrations?: WorldState['migrations']
      actionLog?: WorldState['actionLog']
      landmarks?: WorldState['landmarks']
      nextActionId?: number
    }
    const legacy = structuredClone(saved) as unknown as LegacySnapshot
    legacy.version = 1
    delete legacy.deathRecords
    delete legacy.genealogy
    delete legacy.species
    delete legacy.nextSpeciesId
    delete legacy.climate
    delete legacy.disasters
    delete legacy.groups
    delete legacy.territories
    delete legacy.migrations
    delete legacy.actionLog
    delete legacy.landmarks
    delete legacy.nextActionId
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
      delete creature.speciesId
      delete creature.lastHazard
      delete creature.groupId
      delete creature.territoryId
      delete creature.memory
    }

    const restored = new SimulationEngine(
      saved.seed,
      legacy as unknown as WorldState,
    ).snapshot()

    expect(restored.creatures[0].hydration).toBe(76)
    expect(restored.creatures[0].drinks).toBe(0)
    expect(restored.deathRecords).toEqual([])
    expect(restored.genealogy).toHaveLength(restored.creatures.length)
    expect(restored.species).toHaveLength(2)
    expect(restored.nextSpeciesId).toBe(3)
    expect(restored.version).toBe(2)
    expect(restored.actionLog).toEqual([])
    expect(restored.nextActionId).toBe(1)
    expect(restored.stats.deathsByCause).toEqual({
      predation: 0,
      starvation: 0,
      dehydration: 0,
      disease: 0,
      fire: 0,
      age: 0,
    })
    expect(restored.climate.season).toBeDefined()
    expect(restored.disasters).toEqual([])
    expect(restored.groups).toEqual([])
    expect(restored.territories).toEqual([])
    expect(restored.migrations).toEqual([])
  })

  it('reconstructs the same world from its seed and ordered action log', () => {
    const engine = new SimulationEngine('REPLAY-6204')
    for (let step = 0; step < 120; step += 1) engine.step(0.05)
    const first = engine.state.creatures[0]
    engine.applyWorldAction('water', first.x, first.y, 58)
    for (let step = 0; step < 180; step += 1) engine.step(0.05)
    const second = engine.state.creatures.find((creature) => creature.kind === 'hunter') as Creature
    engine.applyWorldAction('plant', second.x, second.y, 58)
    for (let step = 0; step < 90; step += 1) engine.step(0.05)

    const live = engine.snapshot()
    const replayed = SimulationEngine.replay(live.seed, live.actionLog, live.tick).snapshot()

    expect(live.actionLog).toHaveLength(2)
    expect(replayed).toEqual(live)
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

  it('creates a deterministic species when a compatible population diverges', () => {
    const run = () => {
      const engine = new SimulationEngine('SPECIATION-5518')
      const grazers = engine.state.creatures.filter((creature) => creature.kind === 'grazer').slice(0, 8)
      const anchor = grazers[0]
      const divergentGenes = {
        speed: 70,
        vision: 225,
        size: 1.55,
        metabolism: 0.55,
        fertility: 1.5,
        hue: 35,
      }
      for (const grazer of grazers) {
        grazer.x = anchor.x
        grazer.y = anchor.y
        grazer.targetX = anchor.x
        grazer.targetY = anchor.y
        grazer.generation = 5
        grazer.genes = { ...divergentGenes }
        grazer.energy = 96
        grazer.hydration = 96
        grazer.age = 10
        grazer.reproductionCooldown = 0
        grazer.decisionTimer = 0
      }
      engine.state.creatures = grazers
      for (let step = 0; step < 12; step += 1) engine.step(0.05)
      return engine.snapshot()
    }

    const first = run()
    const second = run()
    const emerged = first.species.filter((record) => record.parentSpeciesId !== null)

    expect(emerged).toHaveLength(1)
    expect(emerged[0].founderId).not.toBeNull()
    expect(emerged[0].population).toBeGreaterThan(0)
    expect(first.events.some((event) => event.kind === 'speciation')).toBe(true)
    expect(second.species).toEqual(first.species)
  })

  it('keeps climate and seed-driven disasters deterministic', () => {
    const run = () => {
      const engine = new SimulationEngine('CLIMATE-4402')
      engine.state.climate.nextSeedEventDay = engine.state.day + 0.01
      for (let step = 0; step < 20; step += 1) engine.step(0.05)
      return engine.snapshot()
    }

    const first = run()
    const second = run()
    expect(first.climate).toEqual(second.climate)
    expect(first.disasters).toEqual(second.disasters)
    expect(first.disasters[0]).toMatchObject({ trigger: 'seed', recoveryNoted: false })
  })

  it('applies bounded regional pressure and records recovery', () => {
    const engine = new SimulationEngine('WILDFIRE-3301')
    const subject = engine.state.creatures[0]
    const distant = engine.state.creatures.find((creature) => {
      const dx = creature.x - subject.x
      const dy = creature.y - subject.y
      return dx * dx + dy * dy > 350 * 350
    })!
    engine.applyWorldAction('wildfire', subject.x, subject.y)
    const disaster = engine.state.disasters.at(-1)!
    expect(disaster).toMatchObject({ type: 'wildfire', trigger: 'player', radius: 110 })
    expect(disaster.affectedCells).toBeGreaterThan(0)
    engine.step(0.05)
    expect(distant.lastHazard).toBeNull()
    for (let step = 0; step < 320; step += 1) engine.step(0.1)

    expect(disaster.recoveryNoted).toBe(true)
    expect(engine.state.events.some((event) => event.kind === 'recovery')).toBe(true)
    expect(engine.state.disasters.length).toBeLessThanOrEqual(16)
  })

  it('forms local groups and starts climate-driven migration toward a scored habitat', () => {
    const run = () => {
      const engine = new SimulationEngine('MIGRATION-7331')
      const members = engine.state.creatures.filter((creature) => creature.kind === 'grazer').slice(0, 4)
      const anchor = members[0]
      for (const member of members) {
        member.x = anchor.x
        member.y = anchor.y
        member.targetX = anchor.x
        member.targetY = anchor.y
        member.decisionTimer = 20
        member.groupId = null
      }
      engine.state.creatures = members
      engine.state.groups = []
      engine.state.territories = []
      for (let step = 0; step < 60; step += 1) engine.step(0.05)
      const group = engine.state.groups[0]
      group.formedDay = engine.state.day - 2
      engine.applyWorldAction('drought', group.x, group.y)
      for (let step = 0; step < 60; step += 1) engine.step(0.05)
      return engine.snapshot()
    }

    const first = run()
    const second = run()
    expect(first.groups).toHaveLength(1)
    expect(first.groups[0].memberIds).toHaveLength(4)
    expect(first.creatures.every((creature) => creature.groupId === first.groups[0].id)).toBe(true)
    expect(first.migrations[0]).toMatchObject({ groupId: first.groups[0].id, reason: 'climate', completedDay: null })
    expect(first.migrations).toEqual(second.migrations)
  })

  it('stores a bounded spatial memory after finding water', () => {
    const engine = new SimulationEngine('MEMORY-4821')
    const point = shorelinePoint(engine.state)
    const creature = engine.state.creatures.find((candidate) => candidate.kind === 'grazer')!
    creature.x = point.x
    creature.y = point.y
    creature.hydration = 24
    creature.energy = 90
    creature.decisionTimer = 0
    engine.state.creatures = [creature]

    engine.step(0.1)

    expect(creature.memory.some((memory) => memory.kind === 'water')).toBe(true)
    expect(creature.memory.length).toBeLessThanOrEqual(6)
  })
})
