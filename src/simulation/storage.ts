import { openDB, type DBSchema } from 'idb'
import type { WorldState } from './types'

interface TerrariumDatabase extends DBSchema {
  worlds: {
    key: string
    value: WorldState
  }
  saves: {
    key: string
    value: SaveSlot
  }
}

const DATABASE_NAME = 'evo-terrarium'
const ACTIVE_WORLD_KEY = 'active-world'

export interface SaveSlot {
  id: string
  name: string
  savedAt: number
  world: WorldState
}

async function database() {
  return openDB<TerrariumDatabase>(DATABASE_NAME, 2, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('worlds')) db.createObjectStore('worlds')
      if (!db.objectStoreNames.contains('saves')) db.createObjectStore('saves')
    },
  })
}

export async function listSaveSlots(): Promise<SaveSlot[]> {
  try {
    const slots = await (await database()).getAll('saves')
    return slots.sort((first, second) => second.savedAt - first.savedAt)
  } catch {
    return []
  }
}

export async function writeSaveSlot(name: string, world: WorldState, id?: string): Promise<SaveSlot> {
  const slot: SaveSlot = {
    id: id ?? `world-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim().slice(0, 48) || `World ${world.seed}`,
    savedAt: Date.now(),
    world: structuredClone(world),
  }
  await (await database()).put('saves', slot, slot.id)
  return slot
}

export async function removeSaveSlot(id: string): Promise<void> {
  await (await database()).delete('saves', id)
}

export async function loadWorld(): Promise<WorldState | undefined> {
  try {
    return (await database()).get('worlds', ACTIVE_WORLD_KEY)
  } catch {
    return undefined
  }
}

export async function saveWorld(world: WorldState): Promise<void> {
  try {
    await (await database()).put('worlds', world, ACTIVE_WORLD_KEY)
  } catch {
    // The simulation stays playable when storage is unavailable or private browsing is restrictive.
  }
}
