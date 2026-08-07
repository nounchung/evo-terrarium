import { useEffect, useRef } from 'react'
import { Application, Container, Graphics } from 'pixi.js'
import type { CreationTool, Creature, DisasterType, WorldState } from '../simulation/types'

interface WorldCanvasProps {
  world: WorldState | null
  selectedId: number | null
  tool: CreationTool
  onSelect: (id: number | null) => void
  onWorldAction: (action: Exclude<CreationTool, 'inspect'>, x: number, y: number) => void
  onOneShotComplete: () => void
}

interface CanvasRuntime {
  app: Application
  viewport: Container
  terrain: Graphics
  plants: Graphics
  creatures: Graphics
  atmosphere: Graphics
  brush: Graphics
  terrainRevision: number
}

interface PointerPosition {
  x: number
  y: number
}

function drawBrushPreview(
  runtime: CanvasRuntime,
  tool: CreationTool,
  point: PointerPosition | null,
): void {
  runtime.brush.clear()
  if (tool === 'inspect' || !point) return
  const disaster = ['drought', 'flood', 'disease', 'wildfire'].includes(tool)
  const radius = tool === 'grazer' || tool === 'hunter' ? 24 : disaster ? (tool === 'drought' ? 150 : tool === 'disease' ? 125 : 110) : 58
  const colour = tool === 'water' || tool === 'flood'
    ? 0x9edbd4
    : tool === 'hunter' || tool === 'wildfire'
      ? 0xe18c70
      : tool === 'disease'
        ? 0xd09edb
        : 0xe2e1a7
  runtime.brush
    .circle(point.x, point.y, radius)
    .fill({ color: colour, alpha: 0.1 })
    .stroke({ color: colour, width: 2 / runtime.viewport.scale.x, alpha: 0.9 })
  runtime.brush
    .circle(point.x, point.y, 3 / runtime.viewport.scale.x)
    .fill({ color: colour, alpha: 0.95 })
}

const BIOME_COLOURS: Record<string, number> = {
  'deep-water': 0x163c3e,
  water: 0x245b56,
  meadow: 0x5f8451,
  grass: 0x4a7248,
  forest: 0x294f3b,
}

function hslToNumber(hue: number, saturation: number, lightness: number): number {
  const s = saturation / 100
  const l = lightness / 100
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const section = ((hue % 360) + 360) % 360 / 60
  const x = chroma * (1 - Math.abs((section % 2) - 1))
  let red = 0
  let green = 0
  let blue = 0
  if (section < 1) [red, green] = [chroma, x]
  else if (section < 2) [red, green] = [x, chroma]
  else if (section < 3) [green, blue] = [chroma, x]
  else if (section < 4) [green, blue] = [x, chroma]
  else if (section < 5) [red, blue] = [x, chroma]
  else [red, blue] = [chroma, x]
  const match = l - chroma / 2
  return (
    (Math.round((red + match) * 255) << 16) |
    (Math.round((green + match) * 255) << 8) |
    Math.round((blue + match) * 255)
  )
}

const geneRatio = (value: number, min: number, max: number) =>
  Math.max(0, Math.min(1, (value - min) / (max - min)))

function drawTerrain(runtime: CanvasRuntime, world: WorldState): void {
  const graphic = runtime.terrain
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
        .fill(BIOME_COLOURS[biome] ?? 0x4a7248)

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
  runtime.terrainRevision = world.terrainRevision
}

function drawPlants(graphic: Graphics, world: WorldState): void {
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

function drawGrazer(graphic: Graphics, creature: Creature): void {
  const scale = creature.genes.size
  const speedShape = geneRatio(creature.genes.speed, 24, 78)
  const visionShape = geneRatio(creature.genes.vision, 55, 240)
  const body = hslToNumber(55 + creature.genes.hue, 70, 72)
  const dark = hslToNumber(55 + creature.genes.hue, 42, 32)
  const headX = creature.x + Math.cos(creature.angle) * 8 * scale
  const headY = creature.y + Math.sin(creature.angle) * 8 * scale
  const legLength = (3 + speedShape * 4) * scale
  const sideX = Math.cos(creature.angle + Math.PI / 2)
  const sideY = Math.sin(creature.angle + Math.PI / 2)
  for (const offset of [-4, 4]) {
    const legX = creature.x + Math.cos(creature.angle) * offset * scale
    const legY = creature.y + Math.sin(creature.angle) * offset * scale
    graphic
      .moveTo(legX - sideX * 2.5 * scale, legY - sideY * 2.5 * scale)
      .lineTo(legX - sideX * legLength, legY - sideY * legLength)
      .stroke({ color: dark, width: 1.3 * scale, alpha: 0.78 })
    graphic
      .moveTo(legX + sideX * 2.5 * scale, legY + sideY * 2.5 * scale)
      .lineTo(legX + sideX * legLength, legY + sideY * legLength)
      .stroke({ color: dark, width: 1.3 * scale, alpha: 0.78 })
  }
  graphic.ellipse(creature.x, creature.y, 8.5 * scale, 5.5 * scale).fill({ color: body, alpha: 0.98 })
  graphic.circle(headX, headY, 4.2 * scale).fill({ color: body, alpha: 1 })
  const earLength = (2.4 + visionShape * 4.5) * scale
  graphic
    .moveTo(headX, headY)
    .lineTo(headX + Math.cos(creature.angle + 1.75) * earLength, headY + Math.sin(creature.angle + 1.75) * earLength)
    .stroke({ color: body, width: 2.1 * scale, alpha: 0.96 })
  graphic
    .moveTo(headX, headY)
    .lineTo(headX + Math.cos(creature.angle - 1.75) * earLength, headY + Math.sin(creature.angle - 1.75) * earLength)
    .stroke({ color: body, width: 2.1 * scale, alpha: 0.96 })
  const markings = Math.max(1, Math.round(geneRatio(creature.genes.fertility, 0.45, 1.6) * 3))
  for (let index = 0; index < markings; index += 1) {
    const offset = (index - (markings - 1) / 2) * 3.1 * scale
    graphic.circle(
      creature.x + Math.cos(creature.angle) * offset,
      creature.y + Math.sin(creature.angle) * offset,
      0.85 * scale,
    ).fill({ color: dark, alpha: 0.38 })
  }
  const eyeX = headX + Math.cos(creature.angle - 0.5) * 2.6 * scale
  const eyeY = headY + Math.sin(creature.angle - 0.5) * 2.6 * scale
  graphic.circle(eyeX, eyeY, 0.85 * scale).fill(dark)
  const tailX = creature.x - Math.cos(creature.angle) * 8 * scale
  const tailY = creature.y - Math.sin(creature.angle) * 8 * scale
  graphic
    .moveTo(tailX, tailY)
    .lineTo(tailX - Math.cos(creature.angle - 0.8) * 5 * scale, tailY - Math.sin(creature.angle - 0.8) * 5 * scale)
    .stroke({ color: dark, width: 1.5 * scale, alpha: 0.8 })
}

function drawHunter(graphic: Graphics, creature: Creature): void {
  const scale = creature.genes.size
  const speedShape = geneRatio(creature.genes.speed, 24, 78)
  const visionShape = geneRatio(creature.genes.vision, 55, 240)
  const colour = hslToNumber(12 + creature.genes.hue, 74, 62)
  const noseX = creature.x + Math.cos(creature.angle) * 11 * scale
  const noseY = creature.y + Math.sin(creature.angle) * 11 * scale
  const leftX = creature.x + Math.cos(creature.angle + 2.35) * 8 * scale
  const leftY = creature.y + Math.sin(creature.angle + 2.35) * 8 * scale
  const rightX = creature.x + Math.cos(creature.angle - 2.35) * 8 * scale
  const rightY = creature.y + Math.sin(creature.angle - 2.35) * 8 * scale
  const tailLength = (7 + speedShape * 8) * scale
  graphic
    .moveTo(creature.x - Math.cos(creature.angle) * 5 * scale, creature.y - Math.sin(creature.angle) * 5 * scale)
    .lineTo(creature.x - Math.cos(creature.angle - 0.35) * tailLength, creature.y - Math.sin(creature.angle - 0.35) * tailLength)
    .stroke({ color: colour, width: 2.2 * scale, alpha: 0.78 })
  graphic.poly([noseX, noseY, leftX, leftY, creature.x - Math.cos(creature.angle) * 5 * scale, creature.y - Math.sin(creature.angle) * 5 * scale, rightX, rightY]).fill({ color: colour, alpha: 0.96 })
  const crestLength = (2 + visionShape * 4) * scale
  graphic
    .moveTo(creature.x, creature.y)
    .lineTo(creature.x + Math.cos(creature.angle + 1.6) * crestLength, creature.y + Math.sin(creature.angle + 1.6) * crestLength)
    .stroke({ color: 0x7d3227, width: 1.8 * scale, alpha: 0.85 })
  const markings = Math.max(1, Math.round(geneRatio(creature.genes.fertility, 0.45, 1.6) * 3))
  for (let index = 0; index < markings; index += 1) {
    const offset = (index - (markings - 1) / 2) * 2.8 * scale
    graphic.circle(
      creature.x - Math.cos(creature.angle) * 1.5 * scale + Math.cos(creature.angle + Math.PI / 2) * offset,
      creature.y - Math.sin(creature.angle) * 1.5 * scale + Math.sin(creature.angle + Math.PI / 2) * offset,
      0.75 * scale,
    ).fill({ color: 0x6f2d25, alpha: 0.55 })
  }
  graphic.circle(noseX, noseY, 1.4 * scale).fill(0x4b1f1a)
  graphic.circle(creature.x + Math.cos(creature.angle - 0.5) * 4 * scale, creature.y + Math.sin(creature.angle - 0.5) * 4 * scale, 0.9 * scale).fill(0xffe7a4)
}

function drawCreatures(
  graphic: Graphics,
  world: WorldState,
  selectedId: number | null,
): void {
  graphic.clear()
  for (const creature of world.creatures) {
    if (creature.id === selectedId) {
      graphic
        .circle(creature.x, creature.y, 15 * creature.genes.size)
        .stroke({ color: 0xffe493, width: 2.2, alpha: 0.95 })
      graphic
        .circle(creature.x, creature.y, 19 * creature.genes.size)
        .stroke({ color: 0xffe493, width: 1, alpha: 0.25 })
    }
    if (creature.kind === 'grazer') drawGrazer(graphic, creature)
    else drawHunter(graphic, creature)
    if (creature.mutations.some((mutation) => mutation.significant)) {
      const markerY = creature.y - 16 * creature.genes.size
      graphic
        .poly([
          creature.x, markerY - 3,
          creature.x + 3, markerY,
          creature.x, markerY + 3,
          creature.x - 3, markerY,
        ])
        .fill({ color: 0xf2d976, alpha: 0.94 })
    }
    if (creature.behaviour === 'drink') {
      const markerY = creature.y - 13 * creature.genes.size
      graphic
        .moveTo(creature.x, markerY - 3.5)
        .bezierCurveTo(
          creature.x - 4,
          markerY + 1,
          creature.x - 2.5,
          markerY + 4.5,
          creature.x,
          markerY + 4.5,
        )
        .bezierCurveTo(
          creature.x + 2.5,
          markerY + 4.5,
          creature.x + 4,
          markerY + 1,
          creature.x,
          markerY - 3.5,
        )
        .fill({ color: 0x91d4d0, alpha: 0.9 })
    }
  }
}

const DISASTER_COLOURS: Record<DisasterType, number> = {
  drought: 0xd8b66b,
  flood: 0x73b9c2,
  disease: 0xbd86ca,
  wildfire: 0xdc7258,
}

function drawAtmosphere(graphic: Graphics, world: WorldState): void {
  graphic.clear()
  const nightAlpha = Math.max(0, 0.28 - world.climate.daylight * 0.27)
  graphic.rect(0, 0, world.width, world.height).fill({ color: 0x06131e, alpha: nightAlpha })
  if (world.climate.temperature > 27) {
    graphic.rect(0, 0, world.width, world.height).fill({ color: 0x7a2e19, alpha: Math.min(0.08, (world.climate.temperature - 27) * 0.012) })
  }
  if (world.climate.rainfall > 0.62) {
    const rainAlpha = (world.climate.rainfall - 0.62) * 0.3
    for (let index = 0; index < 44; index += 1) {
      const x = (index * 193 + world.tick * 0.7) % world.width
      const y = (index * 97 + world.tick * 1.6) % world.height
      graphic.moveTo(x, y).lineTo(x - 5, y + 13).stroke({ color: 0xb4d8d1, width: 1.1, alpha: rainAlpha })
    }
  }
  for (const record of world.disasters) {
    if (world.day >= record.endsDay) continue
    const colour = DISASTER_COLOURS[record.type]
    const progress = (world.day - record.startedDay) / Math.max(0.1, record.endsDay - record.startedDay)
    graphic.circle(record.x, record.y, record.radius).fill({ color: colour, alpha: 0.055 + record.intensity * 0.055 })
    graphic.circle(record.x, record.y, record.radius).stroke({ color: colour, width: 3, alpha: 0.7 })
    graphic.circle(record.x, record.y, record.radius * (0.38 + progress * 0.5)).stroke({ color: colour, width: 1.5, alpha: 0.32 })
  }
}

function fitCamera(runtime: CanvasRuntime, world: WorldState): void {
  const { app, viewport } = runtime
  const portrait = app.screen.height > app.screen.width * 1.18
  const fit = Math.min(app.screen.width / world.width, app.screen.height / world.height)
  const fill = Math.max(app.screen.width / world.width, app.screen.height / world.height)
  const scale = portrait ? fill * 1.05 : fit * 1.04
  viewport.scale.set(scale)
  viewport.position.set(
    (app.screen.width - world.width * scale) / 2,
    (app.screen.height - world.height * scale) / 2,
  )
}

export function WorldCanvas({
  world,
  selectedId,
  tool,
  onSelect,
  onWorldAction,
  onOneShotComplete,
}: WorldCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<CanvasRuntime | null>(null)
  const worldRef = useRef(world)
  const toolRef = useRef(tool)
  const onSelectRef = useRef(onSelect)
  const onActionRef = useRef(onWorldAction)
  const onOneShotCompleteRef = useRef(onOneShotComplete)
  const fittedRef = useRef(false)
  const brushPointRef = useRef<PointerPosition | null>(null)

  worldRef.current = world
  toolRef.current = tool
  onSelectRef.current = onSelect
  onActionRef.current = onWorldAction
  onOneShotCompleteRef.current = onOneShotComplete

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let cancelled = false
    let cleanup = () => undefined

    const boot = async () => {
      const app = new Application()
      await app.init({
        resizeTo: host,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
        background: 0x09140e,
        preference: 'webgl',
      })
      if (cancelled) {
        app.destroy(true)
        return
      }
      app.canvas.setAttribute('aria-label', 'Interactive evolving ecosystem')
      app.canvas.setAttribute('role', 'application')
      host.appendChild(app.canvas)

      const viewport = new Container()
      const terrain = new Graphics()
      const plants = new Graphics()
      const creatures = new Graphics()
      const atmosphere = new Graphics()
      const brush = new Graphics()
      viewport.addChild(terrain, plants, creatures, atmosphere, brush)
      app.stage.addChild(viewport)
      const runtime = { app, viewport, terrain, plants, creatures, atmosphere, brush, terrainRevision: -1 }
      runtimeRef.current = runtime

      const pointers = new Map<number, PointerPosition>()
      let dragStart: PointerPosition | null = null
      let viewportStart: PointerPosition | null = null
      let moved = false
      let pinchDistance = 0
      let pinchScale = 1

      const canvas = app.canvas
      const screenPoint = (event: { clientX: number; clientY: number }): PointerPosition => {
        const bounds = canvas.getBoundingClientRect()
        return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
      }
      const worldPoint = (point: PointerPosition): PointerPosition => ({
        x: (point.x - viewport.x) / viewport.scale.x,
        y: (point.y - viewport.y) / viewport.scale.y,
      })
      const paint = (point: PointerPosition) => {
        const activeTool = toolRef.current
        if (activeTool === 'inspect') return
        const location = worldPoint(point)
        onActionRef.current(activeTool, location.x, location.y)
        if (activeTool === 'grazer' || activeTool === 'hunter') {
          onOneShotCompleteRef.current()
        }
      }
      const zoomAt = (point: PointerPosition, nextScale: number) => {
        const currentScale = viewport.scale.x
        const clamped = Math.max(0.28, Math.min(2.8, nextScale))
        const localX = (point.x - viewport.x) / currentScale
        const localY = (point.y - viewport.y) / currentScale
        viewport.scale.set(clamped)
        viewport.position.set(point.x - localX * clamped, point.y - localY * clamped)
        drawBrushPreview(runtime, toolRef.current, brushPointRef.current)
      }

      const onPointerDown = (event: PointerEvent) => {
        canvas.setPointerCapture(event.pointerId)
        const point = screenPoint(event)
        brushPointRef.current = worldPoint(point)
        drawBrushPreview(runtime, toolRef.current, brushPointRef.current)
        pointers.set(event.pointerId, point)
        if (pointers.size === 1) {
          dragStart = point
          viewportStart = { x: viewport.x, y: viewport.y }
          moved = false
        } else if (pointers.size === 2) {
          const [first, second] = [...pointers.values()]
          pinchDistance = Math.hypot(second.x - first.x, second.y - first.y)
          pinchScale = viewport.scale.x
        }
      }
      const onPointerMove = (event: PointerEvent) => {
        const point = screenPoint(event)
        brushPointRef.current = worldPoint(point)
        drawBrushPreview(runtime, toolRef.current, brushPointRef.current)
        if (!pointers.has(event.pointerId)) return
        pointers.set(event.pointerId, point)
        if (pointers.size === 2) {
          const [first, second] = [...pointers.values()]
          const distance = Math.hypot(second.x - first.x, second.y - first.y)
          const midpoint = { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
          if (pinchDistance > 0) zoomAt(midpoint, pinchScale * (distance / pinchDistance))
          moved = true
          return
        }
        if (!dragStart || !viewportStart) return
        const dx = point.x - dragStart.x
        const dy = point.y - dragStart.y
        if (Math.hypot(dx, dy) > 4) moved = true
        viewport.position.set(viewportStart.x + dx, viewportStart.y + dy)
        brushPointRef.current = worldPoint(point)
        drawBrushPreview(runtime, toolRef.current, brushPointRef.current)
      }
      const onPointerUp = (event: PointerEvent) => {
        const point = screenPoint(event)
        if (toolRef.current === 'inspect' && !moved && pointers.size === 1) {
          const location = worldPoint(point)
          const currentWorld = worldRef.current
          const selectionRadius = 24 / viewport.scale.x
          let selected: Creature | null = null
          let best = selectionRadius * selectionRadius
          for (const creature of currentWorld?.creatures ?? []) {
            const dx = creature.x - location.x
            const dy = creature.y - location.y
            const distance = dx * dx + dy * dy
            if (distance < best) {
              selected = creature
              best = distance
            }
          }
          onSelectRef.current(selected?.id ?? null)
        } else if (toolRef.current !== 'inspect' && !moved && pointers.size === 1) {
          paint(point)
        }
        pointers.delete(event.pointerId)
        dragStart = null
        viewportStart = null
      }
      const onWheel = (event: WheelEvent) => {
        event.preventDefault()
        zoomAt(screenPoint(event), viewport.scale.x * Math.exp(-event.deltaY * 0.0012))
      }
      const onPointerLeave = () => {
        brushPointRef.current = null
        brush.clear()
      }
      const onResize = () => {
        if (worldRef.current && !fittedRef.current) fitCamera(runtime, worldRef.current)
      }
      canvas.addEventListener('pointerdown', onPointerDown)
      canvas.addEventListener('pointermove', onPointerMove)
      canvas.addEventListener('pointerup', onPointerUp)
      canvas.addEventListener('pointercancel', onPointerUp)
      canvas.addEventListener('wheel', onWheel, { passive: false })
      canvas.addEventListener('pointerleave', onPointerLeave)
      window.addEventListener('resize', onResize)

      cleanup = () => {
        canvas.removeEventListener('pointerdown', onPointerDown)
        canvas.removeEventListener('pointermove', onPointerMove)
        canvas.removeEventListener('pointerup', onPointerUp)
        canvas.removeEventListener('pointercancel', onPointerUp)
        canvas.removeEventListener('wheel', onWheel)
        canvas.removeEventListener('pointerleave', onPointerLeave)
        window.removeEventListener('resize', onResize)
        runtimeRef.current = null
        app.destroy(true, { children: true })
      }
    }
    void boot()
    return () => {
      cancelled = true
      cleanup()
    }
  }, [])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (!runtime) return
    drawBrushPreview(runtime, tool, brushPointRef.current)
  }, [tool])

  useEffect(() => {
    const runtime = runtimeRef.current
    if (!runtime || !world) return
    if (!fittedRef.current) {
      fitCamera(runtime, world)
      fittedRef.current = true
    }
    if (runtime.terrainRevision !== world.terrainRevision) drawTerrain(runtime, world)
    drawPlants(runtime.plants, world)
    drawCreatures(runtime.creatures, world, selectedId)
    drawAtmosphere(runtime.atmosphere, world)
  }, [selectedId, world])

  return <div className="world-canvas" ref={hostRef} />
}
