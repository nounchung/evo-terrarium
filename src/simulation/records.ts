import type { WorldState } from './types'

export const WORLD_RECORD_FORMAT = 1

export interface PortableWorldRecord {
  app: 'evo-terrarium'
  formatVersion: 1
  exportedAt: string
  name: string
  world: WorldState
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function validateWorld(value: unknown): value is WorldState {
  if (!value || typeof value !== 'object') return false
  const world = value as Partial<WorldState>
  return world.version === 2 &&
    typeof world.seed === 'string' && world.seed.length > 0 && world.seed.length <= 80 &&
    finite(world.width) && finite(world.height) && finite(world.cellSize) &&
    finite(world.columns) && finite(world.rows) && finite(world.day) && finite(world.tick) &&
    finite(world.rngState) && finite(world.nextEntityId) && finite(world.nextSpeciesId) && finite(world.nextActionId) &&
    Array.isArray(world.terrain) && world.terrain.length === world.columns * world.rows &&
    Array.isArray(world.creatures) && Array.isArray(world.plants) && Array.isArray(world.events) &&
    Array.isArray(world.genealogy) && Array.isArray(world.species) && Array.isArray(world.disasters) &&
    Array.isArray(world.groups) && Array.isArray(world.territories) && Array.isArray(world.migrations) &&
    Array.isArray(world.actionLog) && Array.isArray(world.landmarks) &&
    Boolean(world.climate) && Boolean(world.stats)
}

export function createWorldRecord(name: string, world: WorldState): PortableWorldRecord {
  return {
    app: 'evo-terrarium',
    formatVersion: WORLD_RECORD_FORMAT,
    exportedAt: new Date().toISOString(),
    name: name.trim().slice(0, 48) || `World ${world.seed}`,
    world: structuredClone(world),
  }
}

export function serializeWorldRecord(name: string, world: WorldState): string {
  return JSON.stringify(createWorldRecord(name, world), null, 2)
}

export function parseWorldRecord(text: string): PortableWorldRecord {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON.')
  }
  if (!parsed || typeof parsed !== 'object') throw new Error('This file is not a world record.')
  const record = parsed as Partial<PortableWorldRecord>
  if (record.app !== 'evo-terrarium' || record.formatVersion !== WORLD_RECORD_FORMAT) {
    throw new Error('This world record format is not supported.')
  }
  if (typeof record.name !== 'string' || !validateWorld(record.world)) {
    throw new Error('This world record is incomplete or damaged.')
  }
  return record as PortableWorldRecord
}

export function seedShareUrl(seed: string, locationHref: string): string {
  const url = new URL(locationHref)
  url.search = ''
  url.hash = ''
  url.searchParams.set('seed', seed)
  return url.toString()
}
