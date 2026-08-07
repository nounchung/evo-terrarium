import { CELL_SIZE, WORLD_HEIGHT, WORLD_WIDTH, type Biome } from './types'
import { coordinateNoise } from './rng'

const smoothstep = (value: number) => value * value * (3 - 2 * value)

function valueNoise(seed: string, x: number, y: number, scale: number): number {
  const sampleX = x / scale
  const sampleY = y / scale
  const x0 = Math.floor(sampleX)
  const y0 = Math.floor(sampleY)
  const tx = smoothstep(sampleX - x0)
  const ty = smoothstep(sampleY - y0)

  const top =
    coordinateNoise(seed, x0, y0) * (1 - tx) +
    coordinateNoise(seed, x0 + 1, y0) * tx
  const bottom =
    coordinateNoise(seed, x0, y0 + 1) * (1 - tx) +
    coordinateNoise(seed, x0 + 1, y0 + 1) * tx
  return top * (1 - ty) + bottom * ty
}

export function generateTerrain(seed: string): {
  terrain: Biome[]
  columns: number
  rows: number
} {
  const columns = Math.ceil(WORLD_WIDTH / CELL_SIZE)
  const rows = Math.ceil(WORLD_HEIGHT / CELL_SIZE)
  const terrain: Biome[] = []

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const elevation =
        valueNoise(`${seed}:elevation`, column, row, 8) * 0.62 +
        valueNoise(`${seed}:detail`, column, row, 3) * 0.38
      const moisture =
        valueNoise(`${seed}:moisture`, column, row, 7) * 0.72 +
        valueNoise(`${seed}:moisture-detail`, column, row, 2.5) * 0.28

      if (elevation < 0.29) terrain.push('deep-water')
      else if (elevation < 0.36) terrain.push('water')
      else if (moisture > 0.62) terrain.push('forest')
      else if (moisture > 0.48) terrain.push('meadow')
      else terrain.push('grass')
    }
  }

  return { terrain, columns, rows }
}

export function biomeAt(
  terrain: Biome[],
  columns: number,
  rows: number,
  x: number,
  y: number,
): Biome {
  const column = Math.max(0, Math.min(columns - 1, Math.floor(x / CELL_SIZE)))
  const row = Math.max(0, Math.min(rows - 1, Math.floor(y / CELL_SIZE)))
  return terrain[row * columns + column] ?? 'water'
}

export const isLand = (biome: Biome) => biome !== 'water' && biome !== 'deep-water'

