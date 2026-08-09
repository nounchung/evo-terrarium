import { Graphics } from 'pixi.js'
import {
  CLASSIC_BIOME_COLOURS,
  isWaterBiome,
  sharedTransitionColour,
  terrainCellVisual,
  visualHash,
} from './terrainVisuals'
import type { Biome, WorldState } from '../simulation/types'
import type { CanvasRuntime } from './canvasRuntime'

function drawClassicTerrain(graphic: Graphics, world: WorldState): void {
  graphic.clear()
  graphic.rect(0, 0, world.width, world.height).fill(0x173d35)
  for (let row = 0; row < world.rows; row += 1) {
    for (let column = 0; column < world.columns; column += 1) {
      const index = row * world.columns + column
      const biome = world.terrain[index]
      const x = column * world.cellSize
      const y = row * world.cellSize
      graphic
        .rect(x, y, world.cellSize + 1, world.cellSize + 1)
        .fill(CLASSIC_BIOME_COLOURS[biome] ?? 0x4a7248)

      const pattern = ((index * 9301 + 49297) % 233280) / 233280
      if (biome === 'forest') {
        graphic
          .circle(x + 8 + pattern * 23, y + 9 + ((index * 7) % 19), 7 + pattern * 5)
          .fill({ color: 0x1c4436, alpha: 0.72 })
        graphic
          .circle(x + 28 - pattern * 8, y + 27, 5 + pattern * 4)
          .fill({ color: 0x376144, alpha: 0.7 })
      } else if (biome === 'meadow') {
        graphic
          .circle(x + 8 + pattern * 26, y + 8 + ((index * 13) % 27), 1.4)
          .fill({ color: 0xb7c86b, alpha: 0.55 })
      } else if (biome === 'water' || biome === 'deep-water') {
        graphic
          .moveTo(x + 6, y + 13 + pattern * 10)
          .bezierCurveTo(x + 14, y + 9, x + 25, y + 18, x + 34, y + 13)
          .stroke({ color: 0x8eb9a4, width: 1, alpha: biome === 'water' ? 0.25 : 0.13 })
      }
    }
  }
  graphic
    .rect(2, 2, world.width - 4, world.height - 4)
    .stroke({ color: 0xbad49b, width: 4, alpha: 0.1 })
}

function drawGrassTuft(
  graphic: Graphics,
  x: number,
  y: number,
  scale: number,
  colour: number,
  alpha: number,
): void {
  graphic
    .moveTo(x, y + 3 * scale)
    .bezierCurveTo(x - 1.5 * scale, y, x - 3.5 * scale, y - 2 * scale, x - 4.5 * scale, y - 5 * scale)
    .moveTo(x, y + 3 * scale)
    .bezierCurveTo(x + 0.5 * scale, y - 1 * scale, x + 2 * scale, y - 3 * scale, x + 3.5 * scale, y - 6 * scale)
    .moveTo(x, y + 3 * scale)
    .bezierCurveTo(x + 1.5 * scale, y + 0.5 * scale, x + 4 * scale, y - 0.5 * scale, x + 5 * scale, y - 3.5 * scale)
    .stroke({ color: colour, width: Math.max(0.8, scale), alpha })
}

function drawHabitatDetail(
  graphic: Graphics,
  biome: Biome,
  x: number,
  y: number,
  cellSize: number,
  column: number,
  row: number,
): void {
  const visual = terrainCellVisual(biome, column, row)
  const focusX = x + cellSize * (0.22 + visual.detailX * 0.56)
  const focusY = y + cellSize * (0.22 + visual.detailY * 0.56)

  if (visual.phase > 0.28) {
    graphic
      .ellipse(focusX, focusY, cellSize * (0.32 + visual.phase * 0.1), cellSize * 0.24)
      .fill({ color: visual.accent, alpha: isWaterBiome(biome) ? 0.06 : 0.09 })
  }

  if (biome === 'forest') {
    const crownScale = 0.82 + visual.phase * 0.35
    graphic.ellipse(focusX + 1.5, focusY + 5, 10 * crownScale, 6.5 * crownScale).fill({ color: 0x102f29, alpha: 0.34 })
    graphic.circle(focusX - 4 * crownScale, focusY - 3, 7.2 * crownScale).fill({ color: visual.shade, alpha: 0.96 })
    graphic.circle(focusX + 4.5 * crownScale, focusY - 3.5, 6.6 * crownScale).fill({ color: visual.colour, alpha: 0.98 })
    graphic.circle(focusX, focusY - 8 * crownScale, 8.3 * crownScale).fill({ color: visual.accent, alpha: 0.88 })
  } else if (biome === 'meadow' || biome === 'grass') {
    const count = biome === 'meadow' ? 2 : 1
    for (let detail = 0; detail < count; detail += 1) {
      const tuftX = x + cellSize * (0.16 + visualHash(column, row, 20 + detail) * 0.68)
      const tuftY = y + cellSize * (0.28 + visualHash(column, row, 30 + detail) * 0.58)
      const scale = 0.62 + visualHash(column, row, 40 + detail) * 0.42
      drawGrassTuft(graphic, tuftX, tuftY, scale, biome === 'meadow' ? 0xbed07b : 0x87a866, biome === 'meadow' ? 0.6 : 0.47)
      if (biome === 'meadow' && visualHash(column, row, 50 + detail) > 0.64) {
        graphic.circle(tuftX + 2.5, tuftY - 4.5, 1.15).fill({ color: detail % 2 === 0 ? 0xe2d58c : 0xd4a5a0, alpha: 0.78 })
      }
    }
  } else {
    if (visual.phase <= 0.25) return
    const rippleY = y + cellSize * (0.28 + visual.detailY * 0.48)
    const width = cellSize * (0.3 + visual.phase * 0.28)
    const rippleAlpha = biome === 'water' ? 0.27 : 0.14
    graphic
      .moveTo(focusX - width / 2, rippleY)
      .bezierCurveTo(focusX - width / 5, rippleY - 2, focusX + width / 5, rippleY + 2, focusX + width / 2, rippleY)
      .stroke({ color: visual.accent, width: 1.1, alpha: rippleAlpha })
    if (biome === 'water' && visual.phase > 0.56) {
      graphic.circle(focusX + width * 0.18, rippleY - 5, 1.1).fill({ color: 0xb5d7c7, alpha: 0.34 })
    }
  }
}

interface ContourPoint {
  x: number
  y: number
  hashX: number
  hashY: number
}

type ContourEdge = 0 | 1 | 2 | 3

const CONTOUR_CASES: Record<number, Array<[ContourEdge, ContourEdge]>> = {
  0: [],
  1: [[3, 0]],
  2: [[0, 1]],
  3: [[3, 1]],
  4: [[1, 2]],
  5: [[3, 0], [1, 2]],
  6: [[0, 2]],
  7: [[3, 2]],
  8: [[2, 3]],
  9: [[0, 2]],
  10: [[0, 1], [2, 3]],
  11: [[1, 2]],
  12: [[1, 3]],
  13: [[0, 1]],
  14: [[3, 0]],
  15: [],
}

function contourPoint(
  edge: ContourEdge,
  column: number,
  row: number,
  cellSize: number,
  salt: number,
): ContourPoint {
  const halfCoordinates: Record<ContourEdge, [number, number]> = {
    0: [column * 2 + 2, row * 2 + 1],
    1: [column * 2 + 3, row * 2 + 2],
    2: [column * 2 + 2, row * 2 + 3],
    3: [column * 2 + 1, row * 2 + 2],
  }
  const [hashX, hashY] = halfCoordinates[edge]
  const jitter = cellSize * 0.075
  return {
    x: hashX * cellSize * 0.5 + (visualHash(hashX, hashY, salt) - 0.5) * jitter,
    y: hashY * cellSize * 0.5 + (visualHash(hashX, hashY, salt + 1) - 0.5) * jitter,
    hashX,
    hashY,
  }
}

function drawContourSegment(
  graphic: Graphics,
  start: ContourPoint,
  end: ContourPoint,
  colour: number,
  width: number,
  alpha: number,
  salt: number,
): void {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const distance = Math.max(1, Math.hypot(dx, dy))
  const bend = (visualHash(start.hashX + end.hashX, start.hashY + end.hashY, salt) - 0.5) * 9
  const normalX = -dy / distance
  const normalY = dx / distance
  graphic
    .moveTo(start.x, start.y)
    .bezierCurveTo(
      start.x + dx * 0.34 + normalX * bend,
      start.y + dy * 0.34 + normalY * bend,
      start.x + dx * 0.66 + normalX * bend,
      start.y + dy * 0.66 + normalY * bend,
      end.x,
      end.y,
    )
    .stroke({ color: colour, width, alpha, cap: 'round', join: 'round' })
}

function drawTerrainContour(
  graphic: Graphics,
  world: WorldState,
  matches: (biome: Biome) => boolean,
  strokes: Array<{ colour: number; width: number; alpha: number }>,
  salt: number,
): void {
  for (let row = 0; row < world.rows - 1; row += 1) {
    for (let column = 0; column < world.columns - 1; column += 1) {
      const topLeft = matches(world.terrain[row * world.columns + column])
      const topRight = matches(world.terrain[row * world.columns + column + 1])
      const bottomRight = matches(world.terrain[(row + 1) * world.columns + column + 1])
      const bottomLeft = matches(world.terrain[(row + 1) * world.columns + column])
      const contourCase = (topLeft ? 1 : 0) | (topRight ? 2 : 0) | (bottomRight ? 4 : 0) | (bottomLeft ? 8 : 0)
      for (const [startEdge, endEdge] of CONTOUR_CASES[contourCase]) {
        const start = contourPoint(startEdge, column, row, world.cellSize, salt)
        const end = contourPoint(endEdge, column, row, world.cellSize, salt)
        for (const stroke of strokes) {
          drawContourSegment(graphic, start, end, stroke.colour, stroke.width, stroke.alpha, salt)
        }
      }
    }
  }
}

function drawLivingTerrain(graphic: Graphics, world: WorldState): void {
  graphic.clear()
  graphic.rect(0, 0, world.width, world.height).fill(0x112f2b)

  // Keep contiguous habitat regions visually continuous. Per-cell full-surface
  // colour variation exposed the simulation grid even where the biome did not
  // change; broad overlapping washes provide texture without reintroducing it.
  for (let row = 0; row < world.rows; row += 1) {
    for (let column = 0; column < world.columns; column += 1) {
      const index = row * world.columns + column
      const biome = world.terrain[index]
      const x = column * world.cellSize
      const y = row * world.cellSize
      graphic
        .rect(x, y, world.cellSize + 1, world.cellSize + 1)
        .fill(isWaterBiome(biome) ? 0x245b5b : 0x66844f)
    }
  }

  for (let row = 0; row < world.rows; row += 1) {
    for (let column = 0; column < world.columns; column += 1) {
      const biome = world.terrain[row * world.columns + column]
      const x = column * world.cellSize
      const y = row * world.cellSize
      const visual = terrainCellVisual(biome, column, row)
      const washX = x + world.cellSize * (0.12 + visual.detailX * 0.76)
      const washY = y + world.cellSize * (0.12 + visual.detailY * 0.76)
      const washWidth = world.cellSize * (0.95 + visual.phase * 0.62)
      const washHeight = world.cellSize * (0.7 + visualHash(column, row, 81) * 0.48)
      const washColour = biome === 'forest' || biome === 'deep-water'
        ? visual.shade
        : visual.accent
      const washAlpha = biome === 'forest'
        ? 0.15
        : biome === 'deep-water'
          ? 0.13
          : biome === 'meadow'
            ? 0.11
            : isWaterBiome(biome)
              ? 0.065
              : 0.075
      graphic
        .ellipse(washX, washY, washWidth, washHeight)
        .fill({ color: washColour, alpha: washAlpha })
    }
  }

  for (let row = 0; row < world.rows; row += 1) {
    for (let column = 0; column < world.columns; column += 1) {
      const biome = world.terrain[row * world.columns + column]
      drawHabitatDetail(graphic, biome, column * world.cellSize, row * world.cellSize, world.cellSize, column, row)
    }
  }

  drawTerrainContour(
    graphic,
    world,
    isWaterBiome,
    [
      { colour: 0x102f2d, width: 9, alpha: 0.26 },
      { colour: 0xbdb987, width: 4.2, alpha: 0.52 },
      { colour: 0xe4ddb0, width: 0.9, alpha: 0.58 },
    ],
    90,
  )
  drawTerrainContour(
    graphic,
    world,
    (biome) => biome === 'forest',
    [{ colour: sharedTransitionColour('forest', 'grass'), width: 11, alpha: 0.2 }],
    110,
  )
  drawTerrainContour(
    graphic,
    world,
    (biome) => biome === 'meadow',
    [{ colour: sharedTransitionColour('meadow', 'grass'), width: 8, alpha: 0.16 }],
    130,
  )
  drawTerrainContour(
    graphic,
    world,
    (biome) => biome === 'deep-water',
    [{ colour: sharedTransitionColour('deep-water', 'water'), width: 7, alpha: 0.18 }],
    150,
  )

  graphic
    .rect(2, 2, world.width - 4, world.height - 4)
    .stroke({ color: 0xd5df9b, width: 4, alpha: 0.14 })
}

export function drawTerrain(runtime: CanvasRuntime, world: WorldState): void {
  const startedAt = performance.now()
  if (runtime.terrainStyle === 'classic') drawClassicTerrain(runtime.terrain, world)
  else drawLivingTerrain(runtime.terrain, world)
  if (runtime.terrain.isCachedAsTexture) runtime.terrain.updateCacheTexture()
  else runtime.terrain.cacheAsTexture({ resolution: runtime.app.screen.width < 700 ? 0.9 : 1.2, antialias: true })
  runtime.terrainRevision = world.terrainRevision
  runtime.app.canvas.dataset.terrainCache = 'texture'
  runtime.app.canvas.dataset.terrainRevision = String(world.terrainRevision)
  runtime.app.canvas.dataset.terrainBuildMs = (performance.now() - startedAt).toFixed(2)
}

