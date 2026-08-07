import { openDB, type DBSchema } from 'idb'
import type { WorldState } from './types'

interface TerrariumDatabase extends DBSchema {
  worlds: {
    key: string
    value: WorldState
  }
}

const DATABASE_NAME = 'evo-terrarium'
const ACTIVE_WORLD_KEY = 'active-world'

async function database() {
  return openDB<TerrariumDatabase>(DATABASE_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('worlds')) db.createObjectStore('worlds')
    },
  })
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

