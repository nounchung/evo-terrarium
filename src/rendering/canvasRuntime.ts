import type { Application, Container, Graphics, Texture } from 'pixi.js'
import type { LifeStage } from './creatureVisuals'
import type { CreatureKind } from '../simulation/types'
import type { TerrainStyle } from './terrainVisuals'

export type CreatureTextures = Record<CreatureKind, Record<LifeStage, Texture>>

export interface CanvasRuntime {
  app: Application
  viewport: Container
  terrain: Graphics
  plants: Graphics
  creatures: Container
  atmosphere: Graphics
  social: Graphics
  brush: Graphics
  creatureTextures: CreatureTextures
  creatureQaScene: boolean
  terrainRevision: number
  terrainStyle: TerrainStyle
  reducedMotion: boolean
}
