import { Assets, Container, Graphics, Sprite, type Texture } from 'pixi.js'
import grazerAdultUrl from '../assets/creatures/grazer-adult.png'
import grazerJuvenileUrl from '../assets/creatures/grazer-juvenile.png'
import grazerOlderUrl from '../assets/creatures/grazer-older.png'
import hunterAdultUrl from '../assets/creatures/hunter-adult.png'
import hunterJuvenileUrl from '../assets/creatures/hunter-juvenile.png'
import hunterOlderUrl from '../assets/creatures/hunter-older.png'
import type { Creature, WorldState } from '../simulation/types'
import type { CreatureTextures } from './canvasRuntime'
import { geneRatio, hslToNumber } from './colour'
import {
  RECOGNISABLE_BEHAVIOURS,
  behaviourPoseFor,
  creatureDetailFor,
  creaturesForRendering,
  lifeStageFor,
  lifeStageScale,
} from './creatureVisuals'

const CREATURE_ASSET_URLS = {
  grazer: {
    juvenile: grazerJuvenileUrl,
    adult: grazerAdultUrl,
    older: grazerOlderUrl,
  },
  hunter: {
    juvenile: hunterJuvenileUrl,
    adult: hunterAdultUrl,
    older: hunterOlderUrl,
  },
} as const

export async function loadCreatureTextures(): Promise<CreatureTextures> {
  const [
    grazerJuvenile,
    grazerAdult,
    grazerOlder,
    hunterJuvenile,
    hunterAdult,
    hunterOlder,
  ] = await Promise.all([
    Assets.load<Texture>(CREATURE_ASSET_URLS.grazer.juvenile),
    Assets.load<Texture>(CREATURE_ASSET_URLS.grazer.adult),
    Assets.load<Texture>(CREATURE_ASSET_URLS.grazer.older),
    Assets.load<Texture>(CREATURE_ASSET_URLS.hunter.juvenile),
    Assets.load<Texture>(CREATURE_ASSET_URLS.hunter.adult),
    Assets.load<Texture>(CREATURE_ASSET_URLS.hunter.older),
  ])
  return {
    grazer: { juvenile: grazerJuvenile, adult: grazerAdult, older: grazerOlder },
    hunter: { juvenile: hunterJuvenile, adult: hunterAdult, older: hunterOlder },
  }
}

export function drawPlants(graphic: Graphics, world: WorldState): void {
  graphic.clear()
  for (const plant of world.plants) {
    if (plant.energy < 5) continue
    const vitality = Math.max(0.25, plant.energy / plant.maxEnergy)
    const radius = 2.2 + vitality * 2.9
    const colour = hslToNumber(86 + plant.hue, 48, 45 + vitality * 8)
    graphic
      .moveTo(plant.x, plant.y + radius)
      .lineTo(plant.x, plant.y - radius * 1.8)
      .stroke({ color: 0x1e4a34, width: 1.2, alpha: 0.8 })
    graphic.ellipse(plant.x - radius * 0.55, plant.y - radius * 0.7, radius, radius * 0.55).fill({ color: colour, alpha: 0.94 })
    graphic.ellipse(plant.x + radius * 0.55, plant.y - radius * 1.15, radius * 0.85, radius * 0.5).fill({ color: colour, alpha: 0.88 })
  }
}

function drawBehaviourCue(
  graphic: Graphics,
  creature: Creature,
  cue: ReturnType<typeof behaviourPoseFor>['cue'],
  scale: number,
): void {
  const direction = Math.cos(creature.angle) >= 0 ? 1 : -1
  const ahead = direction * 19 * scale
  if (cue === 'food') {
    graphic
      .moveTo(ahead - 4 * direction, 5)
      .bezierCurveTo(ahead - 2 * direction, 1, ahead + 2 * direction, 1, ahead + 5 * direction, -4)
      .stroke({ color: 0xc9dd8a, width: 1.5, alpha: 0.9 })
    graphic.circle(ahead + 5 * direction, -5, 1.8).fill({ color: 0xe0e59a, alpha: 0.9 })
  } else if (cue === 'water') {
    graphic
      .moveTo(ahead, -8)
      .bezierCurveTo(ahead - 4, -2, ahead - 3, 3, ahead, 3)
      .bezierCurveTo(ahead + 3, 3, ahead + 4, -2, ahead, -8)
      .fill({ color: 0x8dd5d1, alpha: 0.92 })
  } else if (cue === 'threat') {
    graphic
      .moveTo(-ahead * 0.55, -7)
      .lineTo(-ahead * 0.8, 0)
      .lineTo(-ahead * 0.55, 7)
      .stroke({ color: 0xf0a177, width: 2, alpha: 0.86 })
  } else if (cue === 'prey') {
    graphic.circle(ahead + 7 * direction, 0, 6).stroke({ color: 0xe88b70, width: 1.8, alpha: 0.82 })
    graphic.circle(ahead + 7 * direction, 0, 1.7).fill({ color: 0xf1c38f, alpha: 0.92 })
  } else if (cue === 'bond') {
    graphic.circle(-4, -13, 4.8).stroke({ color: 0xf0d58e, width: 1.6, alpha: 0.84 })
    graphic.circle(4, -13, 4.8).stroke({ color: 0xf0d58e, width: 1.6, alpha: 0.84 })
  } else if (cue === 'rest') {
    graphic.moveTo(-10, 9).lineTo(10, 9).stroke({ color: 0xc6d5ab, width: 1.5, alpha: 0.64 })
    graphic.circle(9, -9, 2.2).stroke({ color: 0xdbe3bd, width: 1.1, alpha: 0.68 })
  } else if (cue === 'route') {
    graphic
      .moveTo(-ahead * 0.4, 10)
      .bezierCurveTo(0, 15, ahead * 0.35, 10, ahead * 0.62, 6)
      .stroke({ color: 0x8dd1c8, width: 1.8, alpha: 0.82 })
    graphic
      .moveTo(ahead * 0.62 - 5 * direction, 3)
      .lineTo(ahead * 0.62, 6)
      .lineTo(ahead * 0.62 - 5 * direction, 10)
      .stroke({ color: 0x8dd1c8, width: 1.8, alpha: 0.82 })
  }
}

function drawTrail(graphic: Graphics, creature: Creature, scale: number): void {
  const direction = Math.cos(creature.angle) >= 0 ? 1 : -1
  for (let index = 0; index < 3; index += 1) {
    const length = (9 + index * 6) * scale
    const y = 5 + index * 4
    graphic
      .moveTo(-direction * (12 + index * 4) * scale, y)
      .lineTo(-direction * (12 + index * 4) * scale - direction * length, y)
      .stroke({ color: creature.kind === 'hunter' ? 0xe59a78 : 0xc9d994, width: 1.2, alpha: 0.36 - index * 0.08 })
  }
}

function createCreatureNode(
  creature: Creature,
  worldTick: number,
  selectedId: number | null,
  reducedMotion: boolean,
  textures: CreatureTextures,
  detail: 'full' | 'reduced',
): Container {
  const node = new Container()
  node.position.set(creature.x, creature.y)
  node.zIndex = creature.y

  const stage = lifeStageFor(creature)
  const pose = behaviourPoseFor(creature.behaviour, creature.kind, worldTick * 0.2 + creature.id * 1.37, reducedMotion)
  const direction = Math.cos(creature.angle) >= 0 ? 1 : -1
  const stageScale = lifeStageScale(stage)
  const sizeScale = Math.max(0.68, Math.min(1.45, creature.genes.size))
  const speedShape = geneRatio(creature.genes.speed, 24, 78)
  const visionShape = geneRatio(creature.genes.vision, 55, 240)
  const baseWidth = creature.kind === 'grazer' ? 43 : 47
  const baseScale = (baseWidth / 256) * stageScale * sizeScale

  const shadow = new Graphics()
  shadow.ellipse(0, 9 * stageScale, baseWidth * 0.34 * sizeScale, 5.2 * stageScale).fill({ color: 0x071c17, alpha: detail === 'full' ? 0.24 : 0.16 })
  node.addChild(shadow)

  const cues = new Graphics()
  if (detail === 'full') {
    if (pose.showTrail) drawTrail(cues, creature, stageScale)
    drawBehaviourCue(cues, creature, pose.cue, stageScale)
  }
  node.addChild(cues)

  const sprite = new Sprite(textures[creature.kind][stage])
  sprite.anchor.set(0.5)
  sprite.position.set(pose.offsetX * direction, pose.offsetY)
  sprite.rotation = pose.rotation * direction + Math.sin(creature.angle) * 0.07
  sprite.scale.set(
    direction * baseScale * pose.scaleX * (0.94 + speedShape * 0.12),
    baseScale * pose.scaleY * (1.04 - speedShape * 0.05),
  )
  sprite.tint = creature.kind === 'grazer'
    ? hslToNumber(48 + creature.genes.hue * 0.45, 28 + visionShape * 8, 91)
    : hslToNumber(14 + creature.genes.hue * 0.42, 34 + visionShape * 7, 88)
  sprite.alpha = detail === 'full' ? 1 : 0.96
  node.addChild(sprite)

  const overlay = new Graphics()
  if (creature.id === selectedId) {
    overlay.circle(0, 1, baseWidth * 0.48 * stageScale * sizeScale).stroke({ color: 0xffe493, width: 2.1, alpha: 0.96 })
    overlay.circle(0, 1, baseWidth * 0.59 * stageScale * sizeScale).stroke({ color: 0xffe493, width: 1, alpha: 0.28 })
  }
  if (detail === 'full' && creature.mutations.some((mutation) => mutation.significant)) {
    const markerY = -baseWidth * 0.52 * stageScale * sizeScale
    overlay.poly([0, markerY - 4, 4, markerY, 0, markerY + 4, -4, markerY]).fill({ color: 0xf2d976, alpha: 0.94 })
  }
  node.addChild(overlay)
  return node
}

export function drawCreatures(
  container: Container,
  world: WorldState,
  selectedId: number | null,
  reducedMotion: boolean,
  textures: CreatureTextures,
  zoom: number,
  canvas: HTMLCanvasElement,
  qaScene: boolean,
): void {
  const startedAt = performance.now()
  for (const child of container.removeChildren()) child.destroy({ children: true })
  container.sortableChildren = true
  const compactQa = qaScene && canvas.clientWidth < 700
  const creatures = creaturesForRendering(world, qaScene, compactQa)
  const detail = creatureDetailFor(world.creatures.length, zoom)
  for (const creature of creatures) {
    container.addChild(createCreatureNode(creature, world.tick, selectedId, reducedMotion, textures, detail))
  }
  container.sortChildren()

  const stages = [...new Set(creatures.map(lifeStageFor))].sort()
  const cues = RECOGNISABLE_BEHAVIOURS.filter((behaviour) => creatures.some((creature) => creature.behaviour === behaviour))
  canvas.dataset.creatureRenderer = 'raster-sprites'
  canvas.dataset.creatureCount = String(creatures.length)
  canvas.dataset.creatureDetail = detail
  canvas.dataset.creatureLifeStages = stages.join(',')
  canvas.dataset.creatureBehaviourCues = cues.join(',')
  canvas.dataset.creatureQa = qaScene ? 'species' : 'world'
  canvas.dataset.creatureQaLayout = compactQa ? 'compact' : 'desktop'
  canvas.dataset.reducedMotion = reducedMotion ? 'true' : 'false'
  canvas.dataset.creatureBuildMs = (performance.now() - startedAt).toFixed(2)
}
