import { SeededRandom } from './rng'
import { biomeAt, generateTerrain, isLand } from './terrain'
import {
  CELL_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Biome,
  type ClimateState,
  type Creature,
  type CreatureKind,
  type DeathCause,
  type DeathCounts,
  type DisasterRecord,
  type DisasterType,
  type EcosystemStatus,
  type GeneKey,
  type Genes,
  type GroupRecord,
  type LineageRecord,
  type MemoryKind,
  type MigrationReason,
  type MutationRecord,
  type Plant,
  type Point,
  type SpeciesRecord,
  type SpatialMemory,
  type WorldEvent,
  type WorldState,
} from './types'

const TAU = Math.PI * 2
const MAX_CREATURES = 240
const MAX_PLANTS = 260
const SPATIAL_CELL_SIZE = 120
const SPECIATION_DISTANCE = 0.075
const COMPATIBILITY_DISTANCE = 0.18
const MAX_SPECIES_PER_KIND = 12
const DISASTER_TYPES: DisasterType[] = ['drought', 'flood', 'disease', 'wildfire']

const GENE_RANGES: Record<GeneKey, [number, number]> = {
  speed: [24, 78],
  vision: [55, 240],
  size: [0.58, 1.7],
  metabolism: [0.45, 1.8],
  fertility: [0.45, 1.6],
  hue: [-40, 40],
}

const INITIAL_SIGNATURES: Record<CreatureKind, Genes> = {
  grazer: { speed: 42, vision: 118, size: 0.98, metabolism: 0.92, fertility: 1, hue: 3 },
  hunter: { speed: 50, vision: 155, size: 1.08, metabolism: 1.1, fertility: 0.88, hue: 3 },
}

export function geneticDistance(a: Genes, b: Genes): number {
  const genes = Object.keys(GENE_RANGES) as GeneKey[]
  return genes.reduce((total, gene) => {
    const [min, max] = GENE_RANGES[gene]
    return total + Math.abs(a[gene] - b[gene]) / (max - min)
  }, 0) / genes.length
}

function initialSpecies(kind: CreatureKind): SpeciesRecord {
  return {
    id: kind === 'grazer' ? 1 : 2,
    kind,
    name: kind === 'grazer' ? 'Verdant grazer' : 'Ember stalker',
    founderId: null,
    parentSpeciesId: null,
    emergedDay: 1,
    extinctDay: null,
    population: 0,
    peakPopulation: 0,
    signature: structuredClone(INITIAL_SIGNATURES[kind]),
    populationHistory: [],
  }
}

const emptyDeathCounts = (): DeathCounts => ({
  predation: 0,
  starvation: 0,
  dehydration: 0,
  disease: 0,
  fire: 0,
  age: 0,
})

function climateForDay(day: number, previousMoisture = 62, nextSeedEventDay = day + 24): ClimateState {
  const seasonIndex = Math.floor(day / 7) % 4
  const seasons = ['new-growth', 'high-sun', 'amberfall', 'long-rain'] as const
  const baseTemperature = [18, 28, 20, 15][seasonIndex]
  const baseRainfall = [0.55, 0.12, 0.32, 0.78][seasonIndex]
  const dayFraction = ((day % 1) + 1) % 1
  const daylight = clamp(0.5 - Math.cos(dayFraction * TAU) * 0.5, 0, 1)
  const temperature = baseTemperature + Math.sin(dayFraction * TAU - Math.PI / 2) * 4
  const rainWave = (Math.sin(day * 2.37) + Math.sin(day * 0.73 + 1.8) + 2) / 4
  const rainfall = clamp(baseRainfall * (0.48 + rainWave), 0, 1)
  const soilMoisture = clamp(previousMoisture + (rainfall * 2.2 - 0.72 - Math.max(0, temperature - 24) * 0.035), 8, 96)
  const dayPhase = daylight < 0.12
    ? 'night'
    : dayFraction < 0.32
      ? 'dawn'
      : dayFraction > 0.78
        ? 'dusk'
        : 'day'
  return {
    season: seasons[seasonIndex],
    dayPhase,
    daylight,
    temperature,
    rainfall,
    soilMoisture,
    nextSeedEventDay,
  }
}

const distanceSquared = (a: Point, b: Point) => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

function bucketKey(x: number, y: number, size: number): string {
  return `${Math.floor(x / size)}:${Math.floor(y / size)}`
}

function buildBuckets<T extends Point>(items: T[], size: number): Map<string, T[]> {
  const buckets = new Map<string, T[]>()
  for (const item of items) {
    const key = bucketKey(item.x, item.y, size)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(item)
    else buckets.set(key, [item])
  }
  return buckets
}

function nearby<T extends Point>(
  buckets: Map<string, T[]>,
  point: Point,
  radius: number,
  size: number,
): T[] {
  const cellX = Math.floor(point.x / size)
  const cellY = Math.floor(point.y / size)
  const reach = Math.ceil(radius / size)
  const found: T[] = []
  for (let y = cellY - reach; y <= cellY + reach; y += 1) {
    for (let x = cellX - reach; x <= cellX + reach; x += 1) {
      const bucket = buckets.get(`${x}:${y}`)
      if (bucket) found.push(...bucket)
    }
  }
  return found
}

function nearest<T extends Point>(origin: Point, candidates: T[], radius: number): T | null {
  let best: T | null = null
  let bestDistance = radius * radius
  for (const candidate of candidates) {
    if (candidate === origin) continue
    const currentDistance = distanceSquared(origin, candidate)
    if (currentDistance < bestDistance) {
      best = candidate
      bestDistance = currentDistance
    }
  }
  return best
}

function normaliseRestoredState(restored: WorldState): WorldState {
  const cloned = structuredClone(restored)
  const creatures = cloned.creatures.map((creature) => ({
    ...creature,
    hydration: creature.hydration ?? 76,
    attackCooldown: creature.attackCooldown ?? 0,
    meals: creature.meals ?? 0,
    drinks: creature.drinks ?? 0,
    kills: creature.kills ?? 0,
    lastAttackerId: creature.lastAttackerId ?? null,
    lastAttackTick: creature.lastAttackTick ?? -1,
    lastHazard: creature.lastHazard ?? null,
    groupId: creature.groupId ?? null,
    territoryId: creature.territoryId ?? null,
    memory: creature.memory ?? [],
    bornDay: creature.bornDay ?? Math.max(0, cloned.day - creature.age * 10),
    mutations: creature.mutations ?? [],
    speciesId: creature.speciesId ?? (creature.kind === 'grazer' ? 1 : 2),
  }))
  const species = cloned.species ?? [initialSpecies('grazer'), initialSpecies('hunter')]
  const existingGenealogy = (cloned.genealogy ?? []).map((record) => ({
    ...record,
    speciesId: record.speciesId ?? (record.kind === 'grazer' ? 1 : 2),
  }))
  const genealogyById = new Map(existingGenealogy.map((record) => [record.id, record]))
  for (const creature of creatures) {
    if (genealogyById.has(creature.id)) continue
    genealogyById.set(creature.id, {
      id: creature.id,
      kind: creature.kind,
      speciesId: creature.speciesId,
      species: creature.species,
      generation: creature.generation,
      genes: structuredClone(creature.genes),
      mutations: structuredClone(creature.mutations),
      parents: creature.parents,
      children: [...creature.children],
      bornDay: creature.bornDay,
      diedDay: null,
      deathCause: null,
    })
  }
  for (const death of cloned.deathRecords ?? []) {
    const current = genealogyById.get(death.creatureId)
    if (current) {
      current.diedDay = death.day
      current.deathCause = death.cause
      continue
    }
    genealogyById.set(death.creatureId, {
      id: death.creatureId,
      kind: death.kind,
      speciesId: death.kind === 'grazer' ? 1 : 2,
      species: death.species,
      generation: death.generation,
      genes: null,
      mutations: [],
      parents: null,
      children: [],
      bornDay: 0,
      diedDay: death.day,
      deathCause: death.cause,
    })
  }
  const averageHydration = creatures.length
    ? creatures.reduce((total, creature) => total + creature.hydration, 0) / creatures.length
    : 0
  return {
    ...cloned,
    creatures,
    deathRecords: cloned.deathRecords ?? [],
    genealogy: [...genealogyById.values()],
    species,
    climate: cloned.climate ?? climateForDay(cloned.day, 62, cloned.day + 24),
    disasters: (cloned.disasters ?? []).map((record) => ({ ...record, recoveryNoted: record.recoveryNoted ?? false })),
    groups: cloned.groups ?? [],
    territories: cloned.territories ?? [],
    migrations: cloned.migrations ?? [],
    nextSpeciesId: cloned.nextSpeciesId ?? Math.max(3, ...species.map((record) => record.id + 1)),
    stats: {
      ...cloned.stats,
      kills: cloned.stats.kills ?? 0,
      deathsByCause: { ...emptyDeathCounts(), ...(cloned.stats.deathsByCause ?? {}) },
      averageHydration: cloned.stats.averageHydration ?? averageHydration,
      status: cloned.stats.status ?? 'balanced',
    },
  }
}

export class SimulationEngine {
  public state: WorldState
  private random: SeededRandom
  private wildGrowthTimer = 0
  private lastGrazerCount = 0
  private lastHunterCount = 0
  private waterSources: Point[] = []
  private waterSourcesRevision = -1
  private undoStack: WorldState[] = []

  constructor(seed: string, restored?: WorldState) {
    if (restored?.version === 1) {
      this.state = normaliseRestoredState(restored)
      this.random = new SeededRandom(restored.rngState)
    } else {
      const generated = generateTerrain(seed)
      this.random = new SeededRandom(seed)
      this.state = {
        version: 1,
        seed,
        width: WORLD_WIDTH,
        height: WORLD_HEIGHT,
        cellSize: CELL_SIZE,
        ...generated,
        terrainRevision: 0,
        creatures: [],
        plants: [],
        events: [],
        deathRecords: [],
        genealogy: [],
        species: [initialSpecies('grazer'), initialSpecies('hunter')],
        climate: climateForDay(1, 62, 24 + this.random.range(0, 10)),
        disasters: [],
        groups: [],
        territories: [],
        migrations: [],
        day: 1,
        tick: 0,
        rngState: this.random.state,
        nextEntityId: 1,
        nextSpeciesId: 3,
        stats: {
          grazers: 0,
          hunters: 0,
          plants: 0,
          births: 0,
          deaths: 0,
          kills: 0,
          deathsByCause: emptyDeathCounts(),
          maxGeneration: 1,
          averageEnergy: 0,
          averageHydration: 0,
          status: 'balanced',
        },
      }
      for (let index = 0; index < 150; index += 1) this.spawnPlant()
      for (let index = 0; index < 42; index += 1) this.spawnCreature('grazer')
      for (let index = 0; index < 7; index += 1) this.spawnCreature('hunter')
      this.addEvent('milestone', 'A living world awakens', `Seed ${seed} has begun its first day.`)
      this.updateStats()
    }
    this.refreshWaterSources()
    this.lastGrazerCount = this.state.stats.grazers
    this.lastHunterCount = this.state.stats.hunters
  }

  private nextId(): number {
    const id = this.state.nextEntityId
    this.state.nextEntityId += 1
    return id
  }

  private refreshWaterSources(): void {
    if (this.waterSourcesRevision === this.state.terrainRevision) return
    const sources: Point[] = []
    const neighbours = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]
    for (let row = 0; row < this.state.rows; row += 1) {
      for (let column = 0; column < this.state.columns; column += 1) {
        const biome = this.state.terrain[row * this.state.columns + column]
        if (!isLand(biome)) continue
        const touchesWater = neighbours.some(([offsetX, offsetY]) => {
          const nextColumn = column + offsetX
          const nextRow = row + offsetY
          if (
            nextColumn < 0 ||
            nextColumn >= this.state.columns ||
            nextRow < 0 ||
            nextRow >= this.state.rows
          ) {
            return false
          }
          return !isLand(this.state.terrain[nextRow * this.state.columns + nextColumn])
        })
        if (touchesWater) {
          sources.push({
            x: (column + 0.5) * this.state.cellSize,
            y: (row + 0.5) * this.state.cellSize,
          })
        }
      }
    }
    this.waterSources = sources
    this.waterSourcesRevision = this.state.terrainRevision
  }

  private landPoint(preferred?: Point): Point | null {
    if (
      preferred &&
      isLand(
        biomeAt(
          this.state.terrain,
          this.state.columns,
          this.state.rows,
          preferred.x,
          preferred.y,
        ),
      )
    ) {
      return {
        x: clamp(preferred.x, 8, this.state.width - 8),
        y: clamp(preferred.y, 8, this.state.height - 8),
      }
    }

    for (let attempt = 0; attempt < 80; attempt += 1) {
      const point = {
        x: this.random.range(12, this.state.width - 12),
        y: this.random.range(12, this.state.height - 12),
      }
      if (
        isLand(
          biomeAt(
            this.state.terrain,
            this.state.columns,
            this.state.rows,
            point.x,
            point.y,
          ),
        )
      ) {
        return point
      }
    }
    return null
  }

  spawnPlant(point?: Point): Plant | null {
    if (this.state.plants.length >= MAX_PLANTS) return null
    const location = this.landPoint(point)
    if (!location) return null
    const biome = biomeAt(
      this.state.terrain,
      this.state.columns,
      this.state.rows,
      location.x,
      location.y,
    )
    const plant: Plant = {
      id: this.nextId(),
      ...location,
      energy: this.random.range(35, 80),
      maxEnergy: this.random.range(75, 110),
      growthRate: biome === 'forest' ? 1.2 : biome === 'meadow' ? 1.6 : 0.9,
      hue: this.random.range(-10, 20),
    }
    this.state.plants.push(plant)
    return plant
  }

  private baseGenes(kind: CreatureKind): Genes {
    return kind === 'grazer'
      ? {
          speed: this.random.range(34, 50),
          vision: this.random.range(90, 145),
          size: this.random.range(0.78, 1.18),
          metabolism: this.random.range(0.7, 1.15),
          fertility: this.random.range(0.8, 1.2),
          hue: this.random.range(-18, 24),
        }
      : {
          speed: this.random.range(42, 58),
          vision: this.random.range(120, 190),
          size: this.random.range(0.9, 1.25),
          metabolism: this.random.range(0.9, 1.3),
          fertility: this.random.range(0.7, 1.05),
          hue: this.random.range(-12, 18),
        }
  }

  spawnCreature(
    kind: CreatureKind,
    point?: Point,
    genes?: Genes,
    generation = 1,
    parents: [number, number] | null = null,
    mutations: MutationRecord[] = [],
    speciesId = kind === 'grazer' ? 1 : 2,
  ): Creature | null {
    if (this.state.creatures.length >= MAX_CREATURES) return null
    const location = this.landPoint(point)
    if (!location) return null
    const species = this.state.species.find((record) => record.id === speciesId)
      ?? this.state.species.find((record) => record.kind === kind)
    const creature: Creature = {
      id: this.nextId(),
      kind,
      speciesId: species?.id ?? speciesId,
      species: species?.name ?? (kind === 'grazer' ? 'Verdant grazer' : 'Ember stalker'),
      ...location,
      angle: this.random.range(0, TAU),
      energy: this.random.range(62, 92),
      hydration: this.random.range(68, 96),
      health: 100,
      age: generation === 1 ? this.random.range(1, 9) : 0,
      maxAge: kind === 'grazer' ? this.random.range(34, 48) : this.random.range(44, 62),
      generation,
      genes: genes ?? this.baseGenes(kind),
      mutations,
      bornDay: this.state.day,
      parents,
      children: [],
      behaviour: 'wander',
      targetX: location.x,
      targetY: location.y,
      decisionTimer: this.random.range(0, 0.8),
      reproductionCooldown: generation === 1 ? this.random.range(0, 8) : 9,
      attackCooldown: 0,
      meals: 0,
      drinks: 0,
      kills: 0,
      lastAttackerId: null,
      lastAttackTick: -1,
      lastHazard: null,
      groupId: null,
      territoryId: null,
      memory: [],
    }
    this.state.creatures.push(creature)
    const lineage: LineageRecord = {
      id: creature.id,
      kind: creature.kind,
      speciesId: creature.speciesId,
      species: creature.species,
      generation: creature.generation,
      genes: structuredClone(creature.genes),
      mutations: structuredClone(creature.mutations),
      parents: creature.parents,
      children: [],
      bornDay: creature.bornDay,
      diedDay: null,
      deathCause: null,
    }
    this.state.genealogy.push(lineage)
    return creature
  }

  private mutate(value: number, amount: number, min: number, max: number): number {
    if (!this.random.chance(0.22)) return value
    return clamp(value * (1 + this.random.range(-amount, amount)), min, max)
  }

  private inherit(a: Creature, b: Creature): { genes: Genes; mutations: MutationRecord[] } {
    const choose = (first: number, second: number) =>
      this.random.chance(0.5) ? first : second
    const mutations: MutationRecord[] = []
    const inherited = (gene: GeneKey, amount: number, min: number, max: number) => {
      const inheritedValue = choose(a.genes[gene], b.genes[gene])
      const value = gene === 'hue'
        ? clamp(inheritedValue + (this.random.chance(0.3) ? this.random.range(-8, 8) : 0), min, max)
        : this.mutate(inheritedValue, amount, min, max)
      if (Math.abs(value - inheritedValue) > 0.0001) {
        const changePercent = inheritedValue === 0
          ? Math.abs(value - inheritedValue) * 10
          : Math.abs((value - inheritedValue) / inheritedValue) * 100
        mutations.push({
          gene,
          inheritedValue,
          value,
          changePercent,
          significant: gene === 'hue' ? Math.abs(value - inheritedValue) >= 4 : changePercent >= 5,
        })
      }
      return value
    }
    return {
      genes: {
        speed: inherited('speed', 0.1, 24, 78),
        vision: inherited('vision', 0.12, 55, 240),
        size: inherited('size', 0.08, 0.58, 1.7),
        metabolism: inherited('metabolism', 0.08, 0.45, 1.8),
        fertility: inherited('fertility', 0.1, 0.45, 1.6),
        hue: inherited('hue', 0, -40, 40),
      },
      mutations,
    }
  }

  private populationCapacity(kind: CreatureKind): number {
    const maturePlants = this.state.plants.reduce(
      (total, plant) => total + (plant.energy > 18 ? 1 : 0),
      0,
    )
    const grazers = this.state.creatures.reduce(
      (total, creature) => total + (creature.kind === 'grazer' ? 1 : 0),
      0,
    )
    if (kind === 'grazer') return clamp(Math.floor(maturePlants * 0.72), 16, 180)
    return clamp(Math.floor(grazers / 4.5), 6, 36)
  }

  private canReproduce(kind: CreatureKind): boolean {
    const population = this.state.creatures.reduce(
      (total, creature) => total + (creature.kind === kind ? 1 : 0),
      0,
    )
    return population < this.populationCapacity(kind)
  }

  private areCompatible(a: Creature, b: Creature): boolean {
    return a.kind === b.kind && geneticDistance(a.genes, b.genes) <= COMPATIBILITY_DISTANCE
  }

  private speciesName(kind: CreatureKind, genes: Genes, id: number): string {
    const descriptor = genes.hue > 18
      ? 'Golden'
      : genes.hue < -18
        ? 'Dusky'
        : genes.speed > (kind === 'grazer' ? 51 : 59)
          ? 'Swift'
          : genes.vision > (kind === 'grazer' ? 150 : 195)
            ? 'Farseeing'
            : genes.metabolism < 0.72
              ? 'Frugal'
              : genes.size > 1.28
                ? 'Great'
                : 'Wild'
    const grazerRoots = ['leafback', 'reedrunner', 'meadowling', 'moss deer']
    const hunterRoots = ['ash prowler', 'emberclaw', 'redfang', 'dusk stalker']
    const roots = kind === 'grazer' ? grazerRoots : hunterRoots
    return `${descriptor} ${roots[(id - 3) % roots.length]}`
  }

  private resolveSpecies(
    a: Creature,
    b: Creature,
    genes: Genes,
    generation: number,
  ): { record: SpeciesRecord; emerged: boolean } {
    const livingSpecies = this.state.species.filter(
      (record) => record.kind === a.kind && record.extinctDay === null,
    )
    const distances = livingSpecies
      .map((record) => ({ record, distance: geneticDistance(genes, record.signature) }))
      .sort((first, second) => first.distance - second.distance)
    const nearest = distances[0]
    const fallback = this.state.species.find((record) => record.kind === a.kind)
    if (!nearest) {
      if (!fallback) throw new Error(`Missing base species for ${a.kind}`)
      return { record: fallback, emerged: false }
    }
    const parentPopulation = this.state.creatures.reduce(
      (total, creature) => total + (
        creature.speciesId === a.speciesId || creature.speciesId === b.speciesId ? 1 : 0
      ),
      0,
    )
    if (
      generation >= 5 &&
      parentPopulation >= 8 &&
      livingSpecies.length < MAX_SPECIES_PER_KIND &&
      nearest.distance > SPECIATION_DISTANCE
    ) {
      const id = this.state.nextSpeciesId
      this.state.nextSpeciesId += 1
      const record: SpeciesRecord = {
        id,
        kind: a.kind,
        name: this.speciesName(a.kind, genes, id),
        founderId: null,
        parentSpeciesId: geneticDistance(genes, this.state.species.find((record) => record.id === a.speciesId)?.signature ?? a.genes)
          <= geneticDistance(genes, this.state.species.find((record) => record.id === b.speciesId)?.signature ?? b.genes)
          ? a.speciesId
          : b.speciesId,
        emergedDay: this.state.day,
        extinctDay: null,
        population: 0,
        peakPopulation: 0,
        signature: structuredClone(genes),
        populationHistory: [],
      }
      this.state.species.push(record)
      return { record, emerged: true }
    }
    const preferred = distances.find(({ record }) => record.id === a.speciesId || record.id === b.speciesId)
    return { record: nearest.distance < SPECIATION_DISTANCE ? nearest.record : preferred?.record ?? nearest.record, emerged: false }
  }

  private reproduce(a: Creature, b: Creature): void {
    if (this.state.creatures.length >= MAX_CREATURES || !this.canReproduce(a.kind)) return
    const generation = Math.max(a.generation, b.generation) + 1
    const currentPopulation = this.state.creatures.reduce(
      (total, creature) => total + (creature.kind === a.kind ? 1 : 0),
      0,
    )
    const available = Math.max(0, this.populationCapacity(a.kind) - currentPopulation)
    const litterSize = a.kind === 'hunter' && currentPopulation <= 4 ? 2 : 1
    const children: Creature[] = []
    for (let index = 0; index < Math.min(litterSize, available); index += 1) {
      const inheritance = this.inherit(a, b)
      const resolvedSpecies = this.resolveSpecies(a, b, inheritance.genes, generation)
      const child = this.spawnCreature(
        a.kind,
        {
          x: (a.x + b.x) / 2 + this.random.range(-7, 7),
          y: (a.y + b.y) / 2 + this.random.range(-7, 7),
        },
        inheritance.genes,
        generation,
        [a.id, b.id],
        inheritance.mutations,
        resolvedSpecies.record.id,
      )
      if (child) {
        children.push(child)
        if (resolvedSpecies.emerged) {
          resolvedSpecies.record.founderId = child.id
          this.addEvent(
            'speciation',
            `${resolvedSpecies.record.name} has emerged`,
            `Genetic distance around #${child.id} formed a distinct ${a.kind} lineage.`,
          )
        }
      }
    }
    if (children.length === 0) return
    for (const child of children) {
      a.children.push(child.id)
      b.children.push(child.id)
      for (const parent of [a, b]) {
        const record = this.state.genealogy.find((entry) => entry.id === parent.id)
        if (record && !record.children.includes(child.id)) record.children.push(child.id)
      }
      const important = child.mutations.filter((mutation) => mutation.significant)
      if (important.length > 0) {
        const traits = important.map((mutation) => mutation.gene).join(', ')
        this.addEvent(
          'mutation',
          'A notable mutation appears',
          `${child.species} #${child.id} differs strongly in ${traits}.`,
        )
      }
    }
    a.energy -= 22 + (children.length - 1) * 5
    b.energy -= 18 + (children.length - 1) * 4
    a.hydration -= 7 + (children.length - 1) * 2
    b.hydration -= 6 + (children.length - 1) * 2
    const cooldown = a.kind === 'hunter' ? 9 : 12
    a.reproductionCooldown = cooldown / a.genes.fertility
    b.reproductionCooldown = cooldown / b.genes.fertility
    this.state.stats.births += children.length
    if (generation > this.state.stats.maxGeneration) {
      this.state.stats.maxGeneration = generation
      this.addEvent(
        'birth',
        `Generation ${generation} has arrived`,
        `${children[0].species} #${children[0].id} carries a new combination of inherited traits.`,
      )
    }
  }

  private addEvent(kind: WorldEvent['kind'], title: string, detail: string): void {
    this.state.events.unshift({
      id: this.nextId(),
      day: this.state.day,
      kind,
      title,
      detail,
    })
    this.state.events = this.state.events.slice(0, 20)
  }

  private disasterAt(point: Point, type?: DisasterType): DisasterRecord | null {
    return this.state.disasters.find((record) =>
      this.state.day < record.endsDay &&
      (!type || record.type === type) &&
      distanceSquared(point, record) <= record.radius * record.radius,
    ) ?? null
  }

  private triggerDisaster(
    type: DisasterType,
    x: number,
    y: number,
    trigger: DisasterRecord['trigger'],
  ): DisasterRecord {
    const duration = type === 'drought' ? 5.5 : type === 'disease' ? 4.5 : 3.5
    const radius = type === 'drought' ? 150 : type === 'disease' ? 125 : 110
    const record: DisasterRecord = {
      id: this.nextId(),
      type,
      x: clamp(x, radius, this.state.width - radius),
      y: clamp(y, radius, this.state.height - radius),
      radius,
      intensity: this.random.range(0.72, 1),
      startedDay: this.state.day,
      endsDay: this.state.day + duration,
      trigger,
      affectedCells: 0,
      recoveryNoted: false,
    }

    const radiusCells = Math.ceil(radius / this.state.cellSize)
    const centerColumn = Math.floor(record.x / this.state.cellSize)
    const centerRow = Math.floor(record.y / this.state.cellSize)
    for (let row = centerRow - radiusCells; row <= centerRow + radiusCells; row += 1) {
      for (let column = centerColumn - radiusCells; column <= centerColumn + radiusCells; column += 1) {
        if (column < 0 || column >= this.state.columns || row < 0 || row >= this.state.rows) continue
        const cellX = (column + 0.5) * this.state.cellSize
        const cellY = (row + 0.5) * this.state.cellSize
        if (Math.hypot(cellX - record.x, cellY - record.y) > radius) continue
        const index = row * this.state.columns + column
        const biome = this.state.terrain[index]
        if (!isLand(biome)) continue
        record.affectedCells += 1
        if (type === 'wildfire' && biome === 'forest' && this.random.chance(0.7)) {
          this.state.terrain[index] = 'grass'
        }
        if (type === 'flood' && biome === 'grass' && this.random.chance(0.35)) {
          this.state.terrain[index] = 'meadow'
        }
      }
    }
    if (type === 'wildfire' || type === 'flood') this.state.terrainRevision += 1
    for (const plant of this.state.plants) {
      if (distanceSquared(plant, record) > radius * radius) continue
      if (type === 'wildfire') plant.energy *= 0.12
      else if (type === 'drought') plant.energy *= 0.55
    }
    this.state.disasters.push(record)
    this.state.disasters = this.state.disasters.slice(-16)
    const titles: Record<DisasterType, string> = {
      drought: 'A regional drought begins',
      flood: 'Floodwater reshapes a basin',
      disease: 'Disease enters a population',
      wildfire: 'Wildfire crosses the canopy',
    }
    const origin = trigger === 'player' ? 'Introduced by the world keeper.' : 'The seeded climate produced this event.'
    this.addEvent('disaster', titles[type], `${origin} ${record.affectedCells} habitat cells are exposed.`)
    return record
  }

  private updateClimateAndDisasters(): void {
    this.state.climate = climateForDay(
      this.state.day,
      this.state.climate.soilMoisture,
      this.state.climate.nextSeedEventDay,
    )
    if (this.state.day >= this.state.climate.nextSeedEventDay) {
      const activeCount = this.state.disasters.filter((record) => this.state.day < record.endsDay).length
      if (activeCount < 2) {
        const point = this.landPoint() ?? { x: this.state.width / 2, y: this.state.height / 2 }
        const type = DISASTER_TYPES[this.random.integer(0, DISASTER_TYPES.length - 1)]
        this.triggerDisaster(type, point.x, point.y, 'seed')
      }
      this.state.climate.nextSeedEventDay = this.state.day + this.random.range(24, 38)
    }
    for (const record of this.state.disasters) {
      if (record.recoveryNoted || this.state.day < record.endsDay) continue
      record.recoveryNoted = true
      const details: Record<DisasterType, string> = {
        drought: 'Rain and soil moisture can now rebuild the depleted plant base.',
        flood: 'The water has receded, leaving richer meadow patches behind.',
        disease: 'Transmission has ended; surviving lineages can reproduce again.',
        wildfire: 'The burn front is out, but cleared forest remains open grassland.',
      }
      this.addEvent('recovery', `${record.type[0].toUpperCase()}${record.type.slice(1)} recovery begins`, details[record.type])
    }
  }

  private remember(creature: Creature, kind: MemoryKind, point: Point): void {
    creature.memory = creature.memory.filter((memory) => this.state.day - memory.recordedDay < 8)
    const existing = creature.memory.find((memory) =>
      memory.kind === kind && distanceSquared(memory, point) < 70 * 70,
    )
    if (existing) {
      existing.x = point.x
      existing.y = point.y
      existing.recordedDay = this.state.day
      existing.strength = 1
    } else {
      creature.memory.push({ kind, x: point.x, y: point.y, recordedDay: this.state.day, strength: 1 })
    }
    creature.memory = creature.memory
      .sort((first, second) => second.recordedDay - first.recordedDay)
      .slice(0, 6)
  }

  private recalled(creature: Creature, kind: MemoryKind): SpatialMemory | null {
    const memory = creature.memory
      .filter((record) => record.kind === kind && this.state.day - record.recordedDay < 8)
      .sort((first, second) => second.recordedDay - first.recordedDay)[0]
    if (!memory) return null
    memory.strength = clamp(1 - (this.state.day - memory.recordedDay) / 8, 0, 1)
    return memory
  }

  private activeMigration(groupId: number) {
    return [...this.state.migrations].reverse().find(
      (record) => record.groupId === groupId && record.completedDay === null,
    ) ?? null
  }

  private followGroupDirective(creature: Creature): boolean {
    if (creature.groupId === null) return false
    const group = this.state.groups.find((record) => record.id === creature.groupId)
    if (!group) return false
    const migration = this.activeMigration(group.id)
    if (migration && creature.energy > 34 && creature.hydration > 34) {
      creature.targetX = migration.to.x
      creature.targetY = migration.to.y
      creature.behaviour = 'migrate'
      return true
    }
    const distanceFromGroup = Math.sqrt(distanceSquared(creature, group))
    if (distanceFromGroup > Math.max(82, group.radius * 1.4)) {
      creature.targetX = group.x
      creature.targetY = group.y
      creature.behaviour = 'regroup'
      return true
    }
    const territory = creature.territoryId === null
      ? null
      : this.state.territories.find((record) => record.id === creature.territoryId)
    if (territory && distanceSquared(creature, territory) > (territory.radius * 0.78) ** 2) {
      creature.targetX = territory.x
      creature.targetY = territory.y
      creature.behaviour = 'patrol'
      return true
    }
    return false
  }

  private migrationScore(group: GroupRecord, point: Point): number {
    const biome = biomeAt(this.state.terrain, this.state.columns, this.state.rows, point.x, point.y)
    if (!isLand(biome)) return -Infinity
    const hazardPenalty = this.disasterAt(point) ? 18 : 0
    if (group.kind === 'grazer') {
      const plants = this.state.plants.reduce((total, plant) =>
        total + (plant.energy > 18 && distanceSquared(plant, point) < 190 * 190 ? 1 : 0), 0)
      const hunters = this.state.creatures.reduce((total, creature) =>
        total + (creature.kind === 'hunter' && distanceSquared(creature, point) < 180 * 180 ? 1 : 0), 0)
      return plants - hunters * 3 - hazardPenalty
    }
    const prey = this.state.creatures.reduce((total, creature) =>
      total + (creature.kind === 'grazer' && distanceSquared(creature, point) < 220 * 220 ? 1 : 0), 0)
    const rivals = this.state.creatures.reduce((total, creature) =>
      total + (creature.kind === 'hunter' && creature.groupId !== group.id && distanceSquared(creature, point) < 180 * 180 ? 1 : 0), 0)
    return prey * 1.2 - rivals * 1.5 - hazardPenalty
  }

  private migrationDestination(group: GroupRecord): Point | null {
    const currentScore = this.migrationScore(group, group)
    const candidates: Point[] = []
    for (const radius of [220, 340]) {
      for (let index = 0; index < 8; index += 1) {
        const angle = (index / 8) * TAU
        candidates.push({
          x: clamp(group.x + Math.cos(angle) * radius, 20, this.state.width - 20),
          y: clamp(group.y + Math.sin(angle) * radius, 20, this.state.height - 20),
        })
      }
    }
    const ranked = candidates
      .map((point) => ({ point, score: this.migrationScore(group, point) }))
      .sort((first, second) => second.score - first.score)
    return ranked[0] && ranked[0].score > currentScore + 3 ? ranked[0].point : null
  }

  private updateSocialStructures(): void {
    const livingIds = new Set(this.state.creatures.map((creature) => creature.id))
    for (const group of this.state.groups) {
      const maxSpread = this.activeMigration(group.id) ? 360 : group.kind === 'grazer' ? 230 : 280
      group.memberIds = group.memberIds.filter((id) => {
        if (!livingIds.has(id)) return false
        const member = this.state.creatures.find((creature) => creature.id === id)
        return Boolean(member && distanceSquared(member, group) <= maxSpread * maxSpread)
      })
    }
    const retainedGroups: GroupRecord[] = []
    for (const group of this.state.groups) {
      const minimum = group.kind === 'grazer' ? 3 : 2
      if (group.memberIds.length >= minimum) retainedGroups.push(group)
      else {
        for (const creature of this.state.creatures) {
          if (creature.groupId === group.id) {
            creature.groupId = null
            creature.territoryId = null
          }
        }
      }
    }
    this.state.groups = retainedGroups
    this.state.territories = this.state.territories.filter((territory) =>
      this.state.groups.some((group) => group.id === territory.groupId),
    )

    for (const kind of ['grazer', 'hunter'] as CreatureKind[]) {
      const ungrouped = this.state.creatures
        .filter((creature) => creature.kind === kind && creature.groupId === null)
        .sort((first, second) => first.id - second.id)
      const formationRadius = kind === 'grazer' ? 135 : 180
      const minimum = kind === 'grazer' ? 3 : 2
      while (ungrouped.length >= minimum && this.state.groups.length < 24) {
        const anchor = ungrouped.shift()!
        if (anchor.groupId !== null) continue
        const neighbours = ungrouped.filter((candidate) =>
          candidate.groupId === null && distanceSquared(anchor, candidate) <= formationRadius * formationRadius,
        ).slice(0, kind === 'grazer' ? 7 : 4)
        if (neighbours.length + 1 < minimum) continue
        const members = [anchor, ...neighbours]
        const id = this.nextId()
        const group: GroupRecord = {
          id,
          kind,
          name: kind === 'grazer' ? `Meadow herd ${id}` : `Ember pack ${id}`,
          memberIds: members.map((member) => member.id),
          leaderId: members[0].id,
          x: anchor.x,
          y: anchor.y,
          radius: 0,
          formedDay: this.state.day,
        }
        for (const member of members) member.groupId = id
        this.state.groups.push(group)
        this.addEvent('social', `${group.name} has formed`, `${members.length} ${kind === 'grazer' ? 'grazers now use local herd cohesion' : 'hunters now share a territorial pack'}.`)
      }
    }

    for (const group of this.state.groups) {
      const members = this.state.creatures.filter((creature) => group.memberIds.includes(creature.id))
      if (members.length === 0) continue
      group.x = members.reduce((total, member) => total + member.x, 0) / members.length
      group.y = members.reduce((total, member) => total + member.y, 0) / members.length
      group.radius = members.reduce((largest, member) => Math.max(largest, Math.sqrt(distanceSquared(member, group))), 0)
      group.leaderId = [...members].sort((first, second) => second.energy - first.energy || first.id - second.id)[0].id
      let territory = this.state.territories.find((record) => record.groupId === group.id)
      if (group.kind === 'hunter' && !territory) {
        territory = { id: this.nextId(), groupId: group.id, kind: group.kind, x: group.x, y: group.y, radius: 185, claimedDay: this.state.day, pressure: 0 }
        this.state.territories.push(territory)
      }
      if (territory) {
        territory.x += (group.x - territory.x) * 0.08
        territory.y += (group.y - territory.y) * 0.08
        for (const member of members) member.territoryId = territory.id
      }

      const active = this.activeMigration(group.id)
      if (active) {
        if (distanceSquared(group, active.to) < 85 * 85) {
          active.completedDay = this.state.day
          this.addEvent('migration', `${group.name} completed a migration`, `The ${active.reason}-driven route ended after ${(this.state.day - active.startedDay).toFixed(1)} days.`)
        }
        continue
      }
      if (group.kind === 'hunter') continue
      const recent = [...this.state.migrations].reverse().find((record) => record.groupId === group.id)
      if (recent && this.state.day - (recent.completedDay ?? recent.startedDay) < 6) continue
      if (this.state.day - group.formedDay < 1) continue
      const localHazard = this.disasterAt(group)
      const localResources = this.migrationScore(group, group)
      const trigger = localHazard || localResources < (group.kind === 'grazer' ? group.memberIds.length * 0.7 : group.memberIds.length)
      if (!trigger) continue
      const destination = this.migrationDestination(group)
      if (!destination) continue
      let reason: MigrationReason = localHazard ? 'climate' : 'resources'
      if (group.kind === 'grazer') {
        const threats = this.state.creatures.filter((creature) => creature.kind === 'hunter' && distanceSquared(creature, group) < 170 * 170).length
        if (threats >= Math.max(2, group.memberIds.length * 0.35)) reason = 'threat'
      }
      this.state.migrations.push({ id: this.nextId(), groupId: group.id, reason, from: { x: group.x, y: group.y }, to: destination, startedDay: this.state.day, completedDay: null })
      this.state.migrations = this.state.migrations.slice(-40)
      this.addEvent('migration', `${group.name} begins migrating`, `${reason[0].toUpperCase()}${reason.slice(1)} pressure produced a route toward a stronger habitat score.`)
    }

    for (const territory of this.state.territories) {
      const overlaps = this.state.territories.filter((other) =>
        other.id !== territory.id && distanceSquared(other, territory) < (other.radius + territory.radius) ** 2,
      ).length
      territory.pressure = clamp(overlaps / 3, 0, 1)
    }
  }

  private randomTarget(creature: Creature): void {
    const angle = creature.angle + this.random.range(-1.3, 1.3)
    const distance = this.random.range(45, 150)
    creature.targetX = clamp(creature.x + Math.cos(angle) * distance, 10, this.state.width - 10)
    creature.targetY = clamp(creature.y + Math.sin(angle) * distance, 10, this.state.height - 10)
    creature.behaviour = this.random.chance(0.12) ? 'rest' : 'wander'
  }

  private seekWater(
    creature: Creature,
    waterBuckets: Map<string, Point[]>,
  ): boolean {
    const searchRadius = creature.genes.vision * 2.6
    const source = nearest(
      creature,
      nearby(waterBuckets, creature, searchRadius, SPATIAL_CELL_SIZE),
      searchRadius,
    )
    if (!source) {
      const memory = this.recalled(creature, 'water')
      if (!memory) return false
      creature.targetX = memory.x
      creature.targetY = memory.y
      creature.behaviour = 'drink'
      return true
    }
    this.remember(creature, 'water', source)
    creature.targetX = source.x
    creature.targetY = source.y
    creature.behaviour = 'drink'
    if (distanceSquared(creature, source) < 17 * 17) {
      creature.hydration = clamp(creature.hydration + 46, 0, 100)
      creature.energy = clamp(creature.energy - 0.4, 0, 100)
      creature.drinks += 1
    }
    return true
  }

  private decideGrazer(
    creature: Creature,
    creatureBuckets: Map<string, Creature[]>,
    plantBuckets: Map<string, Plant[]>,
    waterBuckets: Map<string, Point[]>,
  ): void {
    if (biomeAt(this.state.terrain, this.state.columns, this.state.rows, creature.x, creature.y) === 'forest') {
      this.remember(creature, 'shelter', creature)
    }
    const inSight = nearby(creatureBuckets, creature, creature.genes.vision, 120)
    const threat = nearest(
      creature,
      inSight.filter((other) => other.kind === 'hunter'),
      creature.genes.vision,
    )
    if (threat) {
      this.remember(creature, 'threat', threat)
      const dx = creature.x - threat.x
      const dy = creature.y - threat.y
      const length = Math.hypot(dx, dy) || 1
      creature.targetX = clamp(creature.x + (dx / length) * 170, 8, this.state.width - 8)
      creature.targetY = clamp(creature.y + (dy / length) * 170, 8, this.state.height - 8)
      creature.behaviour = 'flee'
      return
    }

    if (creature.hydration < 48 && this.seekWater(creature, waterBuckets)) return

    const plants = nearby(plantBuckets, creature, creature.genes.vision, SPATIAL_CELL_SIZE).filter(
      (plant) => plant.energy > 12,
    )
    const food = nearest(creature, plants, creature.genes.vision)
    if (food && creature.energy < 72) {
      this.remember(creature, 'food', food)
      creature.targetX = food.x
      creature.targetY = food.y
      creature.behaviour = 'forage'
      if (distanceSquared(creature, food) < 14 * 14) {
        const meal = Math.min(food.energy, 18)
        food.energy -= meal
        creature.energy = clamp(creature.energy + meal * 0.72, 0, 100)
        creature.meals += 1
      }
      return
    }

    if (!food && creature.energy < 72) {
      const memory = this.recalled(creature, 'food')
      if (memory) {
        creature.targetX = memory.x
        creature.targetY = memory.y
        creature.behaviour = 'forage'
        return
      }
    }

    if (creature.hydration < 66 && this.seekWater(creature, waterBuckets)) return

    if (
      creature.energy > 75 &&
      creature.hydration > 64 &&
      creature.age > 3 &&
      creature.reproductionCooldown <= 0 &&
      this.canReproduce(creature.kind)
    ) {
      const mate = nearest(
        creature,
        inSight.filter(
          (other) =>
            other.kind === creature.kind &&
            this.areCompatible(creature, other) &&
            other.energy > 70 &&
            other.hydration > 60 &&
            other.age > 3 &&
            other.reproductionCooldown <= 0,
        ),
        creature.genes.vision * 0.72,
      )
      if (mate) {
        creature.targetX = mate.x
        creature.targetY = mate.y
        creature.behaviour = 'mate'
        if (distanceSquared(creature, mate) < 20 * 20 && creature.id < mate.id) {
          this.reproduce(creature, mate)
        }
        return
      }
    }

    if (this.followGroupDirective(creature)) return

    if (food && creature.energy < 90) {
      this.remember(creature, 'food', food)
      creature.targetX = food.x
      creature.targetY = food.y
      creature.behaviour = 'forage'
      if (distanceSquared(creature, food) < 14 * 14) {
        const meal = Math.min(food.energy, 14)
        food.energy -= meal
        creature.energy = clamp(creature.energy + meal * 0.72, 0, 100)
        creature.meals += 1
      }
      return
    }
    this.randomTarget(creature)
  }

  private decideHunter(
    creature: Creature,
    creatureBuckets: Map<string, Creature[]>,
    waterBuckets: Map<string, Point[]>,
  ): void {
    if (biomeAt(this.state.terrain, this.state.columns, this.state.rows, creature.x, creature.y) === 'forest') {
      this.remember(creature, 'shelter', creature)
    }
    const inSight = nearby(
      creatureBuckets,
      creature,
      creature.genes.vision,
      SPATIAL_CELL_SIZE,
    )
    if (creature.hydration < 50 && this.seekWater(creature, waterBuckets)) return

    const hunterPopulation = this.state.creatures.reduce(
      (total, other) => total + (other.kind === 'hunter' ? 1 : 0),
      0,
    )
    const mateUrgency = hunterPopulation <= 7 && this.canReproduce('hunter')

    const prey = nearest(
      creature,
      inSight.filter((other) => other.kind === 'grazer' && other.health > 0),
      creature.genes.vision,
    )
    if (prey && creature.energy < 64) {
      this.remember(creature, 'food', prey)
      this.hunt(creature, prey)
      return
    }

    if (creature.hydration < 68 && this.seekWater(creature, waterBuckets)) return

    if (
      creature.energy > (mateUrgency ? 64 : 80) &&
      creature.hydration > (mateUrgency ? 52 : 65) &&
      creature.age > (mateUrgency ? 2.5 : 4) &&
      creature.reproductionCooldown <= 0 &&
      this.canReproduce(creature.kind)
    ) {
      // Sparse predators use a long-range mating call so viable partners can converge.
      const mateSearchRadius = Math.hypot(this.state.width, this.state.height)
      const mate = nearest(
        creature,
        this.state.creatures.filter(
          (other) =>
            other.kind === 'hunter' &&
            this.areCompatible(creature, other) &&
            other.energy > (mateUrgency ? 60 : 76) &&
            other.hydration > (mateUrgency ? 48 : 62) &&
            other.age > (mateUrgency ? 2.5 : 4) &&
            other.reproductionCooldown <= 0,
        ),
        mateSearchRadius,
      )
      if (mate) {
        creature.targetX = mate.x
        creature.targetY = mate.y
        creature.behaviour = 'mate'
        if (distanceSquared(creature, mate) < 22 * 22 && creature.id < mate.id) {
          this.reproduce(creature, mate)
        }
        return
      }
    }

    if (prey && creature.energy < 91) {
      this.remember(creature, 'food', prey)
      this.hunt(creature, prey)
      return
    }
    if (this.followGroupDirective(creature)) return
    this.randomTarget(creature)
  }

  private hunt(creature: Creature, prey: Creature): void {
    creature.targetX = prey.x
    creature.targetY = prey.y
    creature.behaviour = 'hunt'
    if (distanceSquared(creature, prey) >= 15 * 15 || creature.attackCooldown > 0) return
    prey.health -= 13 + creature.genes.size * 7
    prey.lastAttackerId = creature.id
    prey.lastAttackTick = this.state.tick
    creature.attackCooldown = 0.82
    if (prey.health > 0) return
    creature.energy = clamp(creature.energy + 40 + prey.genes.size * 9, 0, 100)
    creature.meals += 1
    creature.kills += 1
    this.state.stats.kills += 1
  }

  private move(creature: Creature, delta: number): void {
    if (creature.behaviour === 'rest') return
    const dx = creature.targetX - creature.x
    const dy = creature.targetY - creature.y
    const distance = Math.hypot(dx, dy)
    if (distance < 4) return
    const targetAngle = Math.atan2(dy, dx)
    let angleDifference = targetAngle - creature.angle
    angleDifference = Math.atan2(Math.sin(angleDifference), Math.cos(angleDifference))
    creature.angle += angleDifference * Math.min(1, delta * 6)
    const urgency =
      creature.behaviour === 'flee'
        ? 1.38
        : creature.behaviour === 'hunt'
          ? 1.16
          : creature.behaviour === 'drink'
            ? 0.96
            : 0.8
    const speed = creature.genes.speed * urgency
    const nextX = clamp(creature.x + Math.cos(creature.angle) * speed * delta, 7, this.state.width - 7)
    const nextY = clamp(creature.y + Math.sin(creature.angle) * speed * delta, 7, this.state.height - 7)
    const nextBiome = biomeAt(
      this.state.terrain,
      this.state.columns,
      this.state.rows,
      nextX,
      nextY,
    )
    if (isLand(nextBiome)) {
      creature.x = nextX
      creature.y = nextY
    } else {
      creature.angle += Math.PI * this.random.range(0.6, 1.4)
      this.randomTarget(creature)
    }
  }

  private deathCause(creature: Creature): DeathCause | null {
    if (
      creature.health <= 0 &&
      creature.lastAttackerId !== null &&
      this.state.tick - creature.lastAttackTick < 160
    ) {
      return 'predation'
    }
    if (creature.health <= 0 && creature.lastHazard === 'wildfire') return 'fire'
    if (creature.health <= 0 && creature.lastHazard === 'disease') return 'disease'
    if (creature.energy <= 0 || (creature.health <= 0 && creature.energy < 18)) {
      return 'starvation'
    }
    if (creature.hydration <= 0 || (creature.health <= 0 && creature.hydration < 16)) {
      return 'dehydration'
    }
    if (creature.age >= creature.maxAge) return 'age'
    return creature.health <= 0 ? 'starvation' : null
  }

  private recordDeath(creature: Creature, cause: DeathCause): void {
    const previousCount = this.state.stats.deathsByCause[cause]
    this.state.stats.deaths += 1
    this.state.stats.deathsByCause[cause] += 1
    this.state.deathRecords.unshift({
      creatureId: creature.id,
      species: creature.species,
      kind: creature.kind,
      generation: creature.generation,
      day: this.state.day,
      cause,
      killerId: cause === 'predation' ? creature.lastAttackerId : null,
    })
    this.state.deathRecords = this.state.deathRecords.slice(0, 80)
    const lineage = this.state.genealogy.find((record) => record.id === creature.id)
    if (lineage) {
      lineage.diedDay = this.state.day
      lineage.deathCause = cause
    }

    if (previousCount > 0) return
    const descriptions: Record<DeathCause, [string, string]> = {
      predation: [
        'The first successful hunt',
        `${creature.species} #${creature.id} became part of the food chain.`,
      ],
      starvation: [
        'Scarcity claims its first life',
        `${creature.species} #${creature.id} could not find enough food.`,
      ],
      dehydration: [
        'Water shapes survival',
        `${creature.species} #${creature.id} died before reaching a shoreline.`,
      ],
      disease: [
        'Disease changes the population',
        `${creature.species} #${creature.id} did not survive a regional outbreak.`,
      ],
      fire: [
        'Wildfire claims a life',
        `${creature.species} #${creature.id} was caught inside the burn front.`,
      ],
      age: [
        'A natural lifetime ends',
        `${creature.species} #${creature.id} reached age ${creature.age.toFixed(1)}.`,
      ],
    }
    this.addEvent('death', ...descriptions[cause])
  }

  step(delta: number): void {
    this.state.tick += 1
    this.state.day += delta * 0.12
    this.wildGrowthTimer += delta
    this.updateClimateAndDisasters()

    const plantBuckets = buildBuckets(this.state.plants, SPATIAL_CELL_SIZE)
    for (const plant of this.state.plants) {
      const competitors = nearby(
        plantBuckets,
        plant,
        62,
        SPATIAL_CELL_SIZE,
      ).length
      const competitionFactor = Math.max(0.28, 1 - Math.max(0, competitors - 2) * 0.09)
      const drought = this.disasterAt(plant, 'drought')
      const flood = this.disasterAt(plant, 'flood')
      const wildfire = this.disasterAt(plant, 'wildfire')
      const moistureFactor = clamp(this.state.climate.soilMoisture / 58, 0.28, 1.28)
      const seasonFactor = this.state.climate.season === 'high-sun'
        ? 0.76
        : this.state.climate.season === 'long-rain'
          ? 1.18
          : 1
      const disasterFactor = drought ? 0.16 : flood ? 0.48 : wildfire ? 0.05 : 1
      plant.energy = Math.min(
        plant.maxEnergy,
        plant.energy + plant.growthRate * competitionFactor * moistureFactor * seasonFactor * disasterFactor * delta,
      )
      if (drought) plant.energy = Math.max(0, plant.energy - delta * 0.34 * drought.intensity)
      if (wildfire) plant.energy = Math.max(0, plant.energy - delta * 4.2 * wildfire.intensity)
    }
    if (this.wildGrowthTimer > 1.5 && this.state.plants.length < MAX_PLANTS) {
      this.wildGrowthTimer = 0
      this.spawnPlant()
    }

    this.refreshWaterSources()
    const creatureBuckets = buildBuckets(this.state.creatures, SPATIAL_CELL_SIZE)
    const currentPlantBuckets = buildBuckets(this.state.plants, SPATIAL_CELL_SIZE)
    const waterBuckets = buildBuckets(this.waterSources, SPATIAL_CELL_SIZE)

    for (const creature of this.state.creatures) {
      creature.lastHazard = null
      creature.age += delta * 0.1
      creature.reproductionCooldown = Math.max(0, creature.reproductionCooldown - delta)
      creature.attackCooldown = Math.max(0, creature.attackCooldown - delta)
      const movementCost = creature.behaviour === 'rest' ? 0.22 : 0.52
      creature.energy -=
        creature.genes.metabolism * delta * movementCost * (0.7 + creature.genes.size * 0.3)
      const hydrationCost =
        creature.behaviour === 'rest' ? 0.18 : creature.behaviour === 'flee' ? 0.48 : 0.3
      const heatFactor = 1 + Math.max(0, this.state.climate.temperature - 24) * 0.035
      creature.hydration -=
        creature.genes.metabolism * delta * hydrationCost * heatFactor * (0.76 + creature.genes.size * 0.24)
      const drought = this.disasterAt(creature, 'drought')
      const flood = this.disasterAt(creature, 'flood')
      const disease = this.disasterAt(creature, 'disease')
      const wildfire = this.disasterAt(creature, 'wildfire')
      if (drought) creature.hydration -= delta * 0.38 * drought.intensity
      if (flood) creature.energy -= delta * 0.18 * flood.intensity
      if (disease) {
        creature.health -= delta * 0.62 * disease.intensity
        creature.reproductionCooldown += delta * 0.24
        creature.lastHazard = 'disease'
      }
      if (wildfire) {
        creature.health -= delta * 2.4 * wildfire.intensity
        creature.lastHazard = 'wildfire'
      }
      if (creature.energy < 18) creature.health -= delta * 3.1
      if (creature.hydration < 16) creature.health -= delta * 3.6
      if (creature.energy >= 28 && creature.hydration >= 28) {
        creature.health = Math.min(100, creature.health + delta * 0.28)
      }

      creature.decisionTimer -= delta
      if (creature.decisionTimer <= 0) {
        creature.decisionTimer = this.random.range(0.16, 0.45)
        if (creature.kind === 'grazer') {
          this.decideGrazer(creature, creatureBuckets, currentPlantBuckets, waterBuckets)
        } else {
          this.decideHunter(creature, creatureBuckets, waterBuckets)
        }
      }
      this.move(creature, delta)
    }

    const survivors: Creature[] = []
    for (const creature of this.state.creatures) {
      const cause = this.deathCause(creature)
      if (cause) this.recordDeath(creature, cause)
      else survivors.push(creature)
    }
    this.state.creatures = survivors
    if (this.state.tick % 60 === 0) this.updateSocialStructures()
    this.random.state >>>= 0
    this.state.rngState = this.random.state
    this.updateStats()

    if (this.lastGrazerCount > 0 && this.state.stats.grazers === 0) {
      this.addEvent('death', 'Verdant grazers have vanished', 'The food web has lost its primary herbivore.')
    }
    if (this.lastHunterCount > 0 && this.state.stats.hunters === 0) {
      this.addEvent('death', 'Ember stalkers have vanished', 'No predators remain in this world.')
    }
    this.lastGrazerCount = this.state.stats.grazers
    this.lastHunterCount = this.state.stats.hunters
  }

  private updateSpecies(): void {
    const counts = new Map<number, number>()
    for (const creature of this.state.creatures) {
      counts.set(creature.speciesId, (counts.get(creature.speciesId) ?? 0) + 1)
    }
    for (const record of this.state.species) {
      const population = counts.get(record.id) ?? 0
      if (record.population > 0 && population === 0 && record.extinctDay === null) {
        record.extinctDay = this.state.day
        this.addEvent(
          'death',
          `${record.name} has gone extinct`,
          `Its lineage ended after peaking at ${record.peakPopulation} living organisms.`,
        )
      }
      record.population = population
      record.peakPopulation = Math.max(record.peakPopulation, population)
      const previous = record.populationHistory.at(-1)
      if (!previous || this.state.day - previous.day >= 1) {
        record.populationHistory.push({ day: this.state.day, population })
        record.populationHistory = record.populationHistory.slice(-80)
      } else {
        previous.population = population
      }
    }
  }

  private updateStats(): void {
    let grazers = 0
    let hunters = 0
    let generation = 1
    let totalEnergy = 0
    let totalHydration = 0
    for (const creature of this.state.creatures) {
      if (creature.kind === 'grazer') grazers += 1
      else hunters += 1
      generation = Math.max(generation, creature.generation)
      totalEnergy += creature.energy
      totalHydration += creature.hydration
    }
    const plants = this.state.plants.filter((plant) => plant.energy > 12).length
    const averageEnergy = this.state.creatures.length
      ? totalEnergy / this.state.creatures.length
      : 0
    const averageHydration = this.state.creatures.length
      ? totalHydration / this.state.creatures.length
      : 0
    let status: EcosystemStatus = 'balanced'
    if (
      grazers === 0 ||
      plants < 16 ||
      averageEnergy < 28 ||
      averageHydration < 28 ||
      hunters > Math.max(4, grazers * 0.38)
    ) {
      status = 'fragile'
    } else if (
      hunters === 0 ||
      plants < 55 ||
      averageEnergy < 50 ||
      averageHydration < 48 ||
      hunters > Math.max(3, grazers * 0.25)
    ) {
      status = 'stressed'
    }
    this.state.stats = {
      ...this.state.stats,
      grazers,
      hunters,
      plants,
      maxGeneration: generation,
      averageEnergy,
      averageHydration,
      status,
    }
    this.updateSpecies()
  }

  applyWorldAction(action: string, x: number, y: number, radius = 52): void {
    this.undoStack.push(this.snapshot())
    if (this.undoStack.length > 12) this.undoStack.shift()
    if (DISASTER_TYPES.includes(action as DisasterType)) {
      this.triggerDisaster(action as DisasterType, x, y, 'player')
      this.updateStats()
      return
    }
    if (action === 'plant') {
      for (let index = 0; index < 5; index += 1) {
        this.spawnPlant({ x: x + this.random.range(-radius, radius), y: y + this.random.range(-radius, radius) })
      }
      this.updateStats()
      return
    }
    if (action === 'grazer' || action === 'hunter') {
      this.spawnCreature(action, { x, y })
      this.updateStats()
      this.addEvent('player', action === 'grazer' ? 'A grazer was introduced' : 'A hunter was introduced', 'The food web must adapt to a new arrival.')
      return
    }

    const biome: Biome = action === 'water' ? 'water' : action === 'forest' ? 'forest' : 'meadow'
    const radiusCells = Math.max(1, Math.ceil(radius / this.state.cellSize))
    const centerColumn = Math.floor(x / this.state.cellSize)
    const centerRow = Math.floor(y / this.state.cellSize)
    for (let row = centerRow - radiusCells; row <= centerRow + radiusCells; row += 1) {
      for (let column = centerColumn - radiusCells; column <= centerColumn + radiusCells; column += 1) {
        if (column < 0 || column >= this.state.columns || row < 0 || row >= this.state.rows) continue
        const cellX = (column + 0.5) * this.state.cellSize
        const cellY = (row + 0.5) * this.state.cellSize
        if (Math.hypot(cellX - x, cellY - y) <= radius) {
          this.state.terrain[row * this.state.columns + column] = biome
        }
      }
    }
    this.state.terrainRevision += 1
    this.waterSourcesRevision = -1
    this.refreshWaterSources()
    this.state.plants = this.state.plants.filter((plant) =>
      isLand(
        biomeAt(
          this.state.terrain,
          this.state.columns,
          this.state.rows,
          plant.x,
          plant.y,
        ),
      ),
    )
    for (const creature of this.state.creatures) {
      const standingBiome = biomeAt(
        this.state.terrain,
        this.state.columns,
        this.state.rows,
        creature.x,
        creature.y,
      )
      if (isLand(standingBiome)) continue
      const replacement = this.landPoint()
      if (!replacement) continue
      creature.x = replacement.x
      creature.y = replacement.y
      creature.targetX = replacement.x
      creature.targetY = replacement.y
      creature.behaviour = 'wander'
    }
    this.updateStats()
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  undoWorldAction(): boolean {
    const previous = this.undoStack.pop()
    if (!previous) return false
    this.state = previous
    this.random = new SeededRandom(previous.rngState)
    this.waterSourcesRevision = -1
    this.refreshWaterSources()
    this.lastGrazerCount = this.state.stats.grazers
    this.lastHunterCount = this.state.stats.hunters
    return true
  }

  snapshot(): WorldState {
    return structuredClone(this.state)
  }
}
