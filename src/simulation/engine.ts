import { SeededRandom } from './rng'
import { biomeAt, generateTerrain, isLand } from './terrain'
import {
  CELL_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type Biome,
  type Creature,
  type CreatureKind,
  type DeathCause,
  type DeathCounts,
  type EcosystemStatus,
  type Genes,
  type Plant,
  type Point,
  type WorldEvent,
  type WorldState,
} from './types'

const TAU = Math.PI * 2
const MAX_CREATURES = 240
const MAX_PLANTS = 260
const SPATIAL_CELL_SIZE = 120

const emptyDeathCounts = (): DeathCounts => ({
  predation: 0,
  starvation: 0,
  dehydration: 0,
  age: 0,
})

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
  }))
  const averageHydration = creatures.length
    ? creatures.reduce((total, creature) => total + creature.hydration, 0) / creatures.length
    : 0
  return {
    ...cloned,
    creatures,
    deathRecords: cloned.deathRecords ?? [],
    stats: {
      ...cloned.stats,
      kills: cloned.stats.kills ?? 0,
      deathsByCause: cloned.stats.deathsByCause ?? emptyDeathCounts(),
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
        day: 1,
        tick: 0,
        rngState: this.random.state,
        nextEntityId: 1,
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
  ): Creature | null {
    if (this.state.creatures.length >= MAX_CREATURES) return null
    const location = this.landPoint(point)
    if (!location) return null
    const creature: Creature = {
      id: this.nextId(),
      kind,
      species: kind === 'grazer' ? 'Verdant grazer' : 'Ember stalker',
      ...location,
      angle: this.random.range(0, TAU),
      energy: this.random.range(62, 92),
      hydration: this.random.range(68, 96),
      health: 100,
      age: generation === 1 ? this.random.range(1, 9) : 0,
      maxAge: kind === 'grazer' ? this.random.range(34, 48) : this.random.range(44, 62),
      generation,
      genes: genes ?? this.baseGenes(kind),
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
    }
    this.state.creatures.push(creature)
    return creature
  }

  private mutate(value: number, amount: number, min: number, max: number): number {
    if (!this.random.chance(0.22)) return value
    return clamp(value * (1 + this.random.range(-amount, amount)), min, max)
  }

  private inherit(a: Creature, b: Creature): Genes {
    const choose = (first: number, second: number) =>
      this.random.chance(0.5) ? first : second
    return {
      speed: this.mutate(choose(a.genes.speed, b.genes.speed), 0.1, 24, 78),
      vision: this.mutate(choose(a.genes.vision, b.genes.vision), 0.12, 55, 240),
      size: this.mutate(choose(a.genes.size, b.genes.size), 0.08, 0.58, 1.7),
      metabolism: this.mutate(
        choose(a.genes.metabolism, b.genes.metabolism),
        0.08,
        0.45,
        1.8,
      ),
      fertility: this.mutate(
        choose(a.genes.fertility, b.genes.fertility),
        0.1,
        0.45,
        1.6,
      ),
      hue: clamp(
        choose(a.genes.hue, b.genes.hue) + (this.random.chance(0.3) ? this.random.range(-8, 8) : 0),
        -40,
        40,
      ),
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
      const child = this.spawnCreature(
        a.kind,
        {
          x: (a.x + b.x) / 2 + this.random.range(-7, 7),
          y: (a.y + b.y) / 2 + this.random.range(-7, 7),
        },
        this.inherit(a, b),
        generation,
        [a.id, b.id],
      )
      if (child) children.push(child)
    }
    if (children.length === 0) return
    for (const child of children) {
      a.children.push(child.id)
      b.children.push(child.id)
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
    if (!source) return false
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
    const inSight = nearby(creatureBuckets, creature, creature.genes.vision, 120)
    const threat = nearest(
      creature,
      inSight.filter((other) => other.kind === 'hunter'),
      creature.genes.vision,
    )
    if (threat) {
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

    if (food && creature.energy < 90) {
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
    const mateUrgency = hunterPopulation <= 4 && this.canReproduce('hunter')

    const prey = nearest(
      creature,
      inSight.filter((other) => other.kind === 'grazer' && other.health > 0),
      creature.genes.vision,
    )
    if (prey && creature.energy < 64) {
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
      this.hunt(creature, prey)
      return
    }
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

    const plantBuckets = buildBuckets(this.state.plants, SPATIAL_CELL_SIZE)
    for (const plant of this.state.plants) {
      const competitors = nearby(
        plantBuckets,
        plant,
        62,
        SPATIAL_CELL_SIZE,
      ).length
      const competitionFactor = Math.max(0.28, 1 - Math.max(0, competitors - 2) * 0.09)
      plant.energy = Math.min(
        plant.maxEnergy,
        plant.energy + plant.growthRate * competitionFactor * delta,
      )
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
      creature.age += delta * 0.1
      creature.reproductionCooldown = Math.max(0, creature.reproductionCooldown - delta)
      creature.attackCooldown = Math.max(0, creature.attackCooldown - delta)
      const movementCost = creature.behaviour === 'rest' ? 0.22 : 0.52
      creature.energy -=
        creature.genes.metabolism * delta * movementCost * (0.7 + creature.genes.size * 0.3)
      const hydrationCost =
        creature.behaviour === 'rest' ? 0.18 : creature.behaviour === 'flee' ? 0.48 : 0.3
      creature.hydration -=
        creature.genes.metabolism * delta * hydrationCost * (0.76 + creature.genes.size * 0.24)
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
  }

  applyWorldAction(action: string, x: number, y: number, radius = 52): void {
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

  snapshot(): WorldState {
    return structuredClone(this.state)
  }
}
