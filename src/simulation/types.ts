export const WORLD_WIDTH = 1440
export const WORLD_HEIGHT = 900
export const CELL_SIZE = 40

export type Biome = 'deep-water' | 'water' | 'meadow' | 'grass' | 'forest'
export type CreatureKind = 'grazer' | 'hunter'
export type Behaviour = 'wander' | 'forage' | 'drink' | 'flee' | 'hunt' | 'mate' | 'rest'
export type SimSpeed = 0 | 1 | 5 | 20 | 100
export type DeathCause = 'predation' | 'starvation' | 'dehydration' | 'age'
export type EcosystemStatus = 'balanced' | 'stressed' | 'fragile'

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

export interface Creature extends Point {
  id: number
  kind: CreatureKind
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
  kind: 'birth' | 'death' | 'milestone' | 'mutation' | 'player'
  title: string
  detail: string
}

export interface LineageRecord {
  id: number
  kind: CreatureKind
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
  version: 1
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
  day: number
  tick: number
  rngState: number
  nextEntityId: number
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

export type WorkerCommand =
  | { type: 'init'; seed: string; restored?: WorldState }
  | { type: 'speed'; speed: SimSpeed }
  | { type: 'reset'; seed: string }
  | {
      type: 'world-action'
      action: Exclude<CreationTool, 'inspect'>
      x: number
      y: number
      radius?: number
    }
  | { type: 'snapshot' }
  | { type: 'undo' }

export type WorkerMessage =
  | { type: 'ready'; world: WorldState; canUndo: boolean }
  | { type: 'snapshot'; world: WorldState; speed: SimSpeed; canUndo: boolean }
