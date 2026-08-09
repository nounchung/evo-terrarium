import { describe, expect, it } from 'vitest'
import {
  isWaterBiome,
  mixColour,
  terrainCellVisual,
  terrainStyleFromSearch,
  visualHash,
} from './terrainVisuals'

describe('Living Diorama terrain visuals', () => {
  it('uses the Living renderer by default and retains a classic comparison mode', () => {
    expect(terrainStyleFromSearch('')).toBe('living')
    expect(terrainStyleFromSearch('?seed=MOSS-1738')).toBe('living')
    expect(terrainStyleFromSearch('?terrain=classic&seed=MOSS-1738')).toBe('classic')
  })

  it('produces stable bounded detail samples', () => {
    const first = terrainCellVisual('forest', 12, 8)
    const second = terrainCellVisual('forest', 12, 8)
    expect(second).toEqual(first)
    expect(visualHash(12, 8, 1)).toBeGreaterThanOrEqual(0)
    expect(visualHash(12, 8, 1)).toBeLessThan(1)
    expect(visualHash(12, 8, 1)).not.toBe(visualHash(12, 8, 2))
  })

  it('keeps water classification and colour mixing explicit', () => {
    expect(isWaterBiome('deep-water')).toBe(true)
    expect(isWaterBiome('water')).toBe(true)
    expect(isWaterBiome('meadow')).toBe(false)
    expect(mixColour(0x000000, 0xffffff, 0.5)).toBe(0x808080)
    expect(mixColour(0x123456, 0xffffff, 0)).toBe(0x123456)
  })
})
