export const WORLD_WIDTH = 1440
export const WORLD_HEIGHT = 900
export const CELL_SIZE = 40

export type Biome = 'deep-water' | 'water' | 'meadow' | 'grass' | 'forest'
export type CreatureKind = 'grazer' | 'hunter'
export type Behaviour = 'wander' | 'forage' | 'drink' | 'flee' | 'hunt' | 'mate' | 'rest' | 'regroup' | 'patrol' | 'migrate'
export type SimSpeed = 0 | 1 | 5 | 20 | 100
export type DeathCause = 'predation' | 'starvation' | 'dehydration' | 'disease' | 'fire' | 'age'
export type EcosystemStatus = 'balanced' | 'stressed' | 'fragile'
export type Season = 'new-growth' | 'high-sun' | 'amberfall' | 'long-rain'
export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night'
export type DisasterType = 'drought' | 'flood' | 'disease' | 'wildfire'
export type MemoryKind = 'food' | 'water' | 'threat' | 'shelter'
export type MigrationReason = 'resources' | 'climate' | 'threat'

export interface Point {
  x: number
  y: number
}

export interface Genes {
  speed: number
  vision: number
  size: number
  metabolism: number
  fertility: number
  hue: number
}

export type GeneKey = keyof Genes

export interface MutationRecord {
  gene: GeneKey
  inheritedValue: number
  value: number
  changePercent: number
  significant: boolean
}

export interface SpatialMemory extends Point {
  kind: MemoryKind
  recordedDay: number
  strength: number
}

export interface Creature extends Point {
  id: number
  kind: CreatureKind
  speciesId: number
  species: string
  angle: number
  energy: number
  hydration: number
  health: number
  age: number
  maxAge: number
  generation: number
  genes: Genes
  mutations: MutationRecord[]
  bornDay: number
  parents: [number, number] | null
  children: number[]
  behaviour: Behaviour
  targetX: number
  targetY: number
  decisionTimer: number
  reproductionCooldown: number
  attackCooldown: number
  meals: number
  drinks: number
  kills: number
  lastAttackerId: number | null
  lastAttackTick: number
  lastHazard: DisasterType | null
  groupId: number | null
  territoryId: number | null
  memory: SpatialMemory[]
}

export interface Plant extends Point {
  id: number
  energy: number
  maxEnergy: number
  growthRate: number
  hue: number
}

export interface WorldEvent {
  id: number
  day: number
  kind: 'birth' | 'death' | 'milestone' | 'mutation' | 'player' | 'speciation' | 'disaster' | 'recovery' | 'social' | 'migration'
  title: string
  detail: string
}

export interface WorldActionRecord {
  id: number
  tick: number
  day: number
  action: Exclude<CreationTool, 'inspect'>
  x: number
  y: number
  radius: number
}

export interface LandmarkRecord {
  id: number
  tick: number
  day: number
  kind: WorldEvent['kind']
  title: string
  detail: string
}

export interface LineageRecord {
  id: number
  kind: CreatureKind
  speciesId: number
  species: string
  generation: number
  genes: Genes | null
  mutations: MutationRecord[]
  parents: [number, number] | null
  children: number[]
  bornDay: number
  diedDay: number | null
  deathCause: DeathCause | null
}

export interface SpeciesPopulationPoint {
  day: number
  population: number
}

export interface SpeciesRecord {
  id: number
  kind: CreatureKind
  name: string
  founderId: number | null
  parentSpeciesId: number | null
  emergedDay: number
  extinctDay: number | null
  population: number
  peakPopulation: number
  signature: Genes
  populationHistory: SpeciesPopulationPoint[]
}

export interface ClimateState {
  season: Season
  dayPhase: DayPhase
  daylight: number
  temperature: number
  rainfall: number
  soilMoisture: number
  nextSeedEventDay: number
}

export interface DisasterRecord extends Point {
  id: number
  type: DisasterType
  radius: number
  intensity: number
  startedDay: number
  endsDay: number
  trigger: 'seed' | 'player'
  affectedCells: number
  recoveryNoted: boolean
}

export interface GroupRecord extends Point {
  id: number
  kind: CreatureKind
  name: string
  memberIds: number[]
  leaderId: number
  radius: number
  formedDay: number
}

export interface TerritoryRecord extends Point {
  id: number
  groupId: number
  kind: CreatureKind
  radius: number
  claimedDay: number
  pressure: number
}

export interface MigrationRecord {
  id: number
  groupId: number
  reason: MigrationReason
  from: Point
  to: Point
  startedDay: number
  completedDay: number | null
}

export interface DeathRecord {
  creatureId: number
  species: string
  kind: CreatureKind
  generation: number
  day: number
  cause: DeathCause
  killerId: number | null
}

export type DeathCounts = Record<DeathCause, number>

export interface WorldStats {
  grazers: number
  hunters: number
  plants: number
  births: number
  deaths: number
  kills: number
  deathsByCause: DeathCounts
  maxGeneration: number
  averageEnergy: number
  averageHydration: number
  status: EcosystemStatus
}

export interface WorldState {
  version: 2
  seed: string
  width: number
  height: number
  cellSize: number
  columns: number
  rows: number
  terrain: Biome[]
  terrainRevision: number
  creatures: Creature[]
  plants: Plant[]
  events: WorldEvent[]
  deathRecords: DeathRecord[]
  genealogy: LineageRecord[]
  species: SpeciesRecord[]
  climate: ClimateState
  disasters: DisasterRecord[]
  groups: GroupRecord[]
  territories: TerritoryRecord[]
  migrations: MigrationRecord[]
  actionLog: WorldActionRecord[]
  landmarks: LandmarkRecord[]
  day: number
  tick: number
  rngState: number
  nextEntityId: number
  nextSpeciesId: number
  nextActionId: number
  stats: WorldStats
}

export type CreationTool =
  | 'inspect'
  | 'grass'
  | 'water'
  | 'forest'
  | 'plant'
  | 'grazer'
  | 'hunter'
  | DisasterType

export type WorkerCommand =
  | { type: 'init'; seed: string; restored?: WorldState }
  | { type: 'speed'; speed: SimSpeed }
  | { type: 'reset'; seed: string }
  | { type: 'restore'; world: WorldState }
  | {
      type: 'world-action'
      action: Exclude<CreationTool, 'inspect'>
      x: number
      y: number
      radius?: number
    }
  | { type: 'snapshot' }
  | { type: 'undo' }
  | { type: 'replay-seek'; tick: number }
  | { type: 'replay-exit' }

export interface ReplayStatus {
  active: boolean
  currentTick: number
  maxTick: number
}

export type WorkerMessage =
  | { type: 'ready'; world: WorldState; speed: SimSpeed; canUndo: boolean; replay: ReplayStatus }
  | { type: 'snapshot'; world: WorldState; speed: SimSpeed; canUndo: boolean; replay: ReplayStatus }
