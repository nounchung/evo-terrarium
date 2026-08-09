import type { Biome } from '../simulation/types'

export type TerrainStyle = 'classic' | 'living'

interface TerrainPalette {
  base: number
  light: number
  shade: number
}

export const CLASSIC_BIOME_COLOURS: Record<Biome, number> = {
  'deep-water': 0x163c3e,
  water: 0x245b56,
  meadow: 0x5f8451,
  grass: 0x4a7248,
  forest: 0x294f3b,
}

export const LIVING_BIOME_PALETTES: Record<Biome, TerrainPalette> = {
  'deep-water': { base: 0x153d43, light: 0x2f6666, shade: 0x0b2930 },
  water: { base: 0x286865, light: 0x72aaa0, shade: 0x17474a },
  meadow: { base: 0x789758, light: 0xb3c578, shade: 0x4c6d43 },
  grass: { base: 0x587d4e, light: 0x88a866, shade: 0x355d42 },
  forest: { base: 0x315b43, light: 0x557c4e, shade: 0x193f35 },
}

export interface TerrainCellVisual {
  colour: number
  accent: number
  shade: number
  detailX: number
  detailY: number
  phase: number
}

export function terrainStyleFromSearch(search: string): TerrainStyle {
  return new URLSearchParams(search).get('terrain') === 'classic' ? 'classic' : 'living'
}

export function isWaterBiome(biome: Biome): boolean {
  return biome === 'water' || biome === 'deep-water'
}

export function visualHash(column: number, row: number, salt = 0): number {
  let value = Math.imul(column + 11, 374_761_393)
  value = Math.imul(value ^ Math.imul(row + 17, 668_265_263), 1_274_126_177)
  value ^= Math.imul(salt + 31, 2_246_822_519)
  value = Math.imul(value ^ (value >>> 13), 1_274_126_177)
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_296
}

export function mixColour(first: number, second: number, amount: number): number {
  const t = Math.max(0, Math.min(1, amount))
  const firstRed = (first >> 16) & 0xff
  const firstGreen = (first >> 8) & 0xff
  const firstBlue = first & 0xff
  const secondRed = (second >> 16) & 0xff
  const secondGreen = (second >> 8) & 0xff
  const secondBlue = second & 0xff
  return (
    (Math.round(firstRed + (secondRed - firstRed) * t) << 16)
    | (Math.round(firstGreen + (secondGreen - firstGreen) * t) << 8)
    | Math.round(firstBlue + (secondBlue - firstBlue) * t)
  )
}

export function terrainCellVisual(biome: Biome, column: number, row: number): TerrainCellVisual {
  const palette = LIVING_BIOME_PALETTES[biome]
  const tone = visualHash(column, row, 1)
  const towardLight = tone > 0.5
  const strength = 0.08 + Math.abs(tone - 0.5) * 0.18
  return {
    colour: mixColour(palette.base, towardLight ? palette.light : palette.shade, strength),
    accent: mixColour(palette.base, palette.light, 0.4 + visualHash(column, row, 2) * 0.25),
    shade: mixColour(palette.base, palette.shade, 0.48 + visualHash(column, row, 3) * 0.2),
    detailX: visualHash(column, row, 4),
    detailY: visualHash(column, row, 5),
    phase: visualHash(column, row, 6),
  }
}

export function sharedTransitionColour(first: Biome, second: Biome): number {
  return mixColour(LIVING_BIOME_PALETTES[first].base, LIVING_BIOME_PALETTES[second].base, 0.5)
}
