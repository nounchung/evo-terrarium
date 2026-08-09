import { useEffect, useRef } from 'react'
import { Application, Container, Graphics } from 'pixi.js'
import { useI18n } from '../i18n'
import { drawAtmosphere } from '../rendering/atmosphereRenderer'
import type { CanvasRuntime } from '../rendering/canvasRuntime'
import {
  drawCreatures,
  drawPlants,
  loadCreatureTextures,
} from '../rendering/organismRenderer'
import { drawSocialLab } from '../rendering/socialRenderer'
import { drawTerrain } from '../rendering/terrainRenderer'
import { terrainStyleFromSearch } from '../rendering/terrainVisuals'
import { speciesQaRequested } from '../rendering/creatureVisuals'
import type { CreationTool, Creature, WorldState } from '../simulation/types'

interface WorldCanvasProps {
  world: WorldState | null
  selectedId: number | null
  tool: CreationTool
  labMode: boolean
  onSelect: (id: number | null) => void
  onWorldAction: (action: Exclude<CreationTool, 'inspect'>, x: number, y: number) => void
  onOneShotComplete: () => void
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
  labMode,
  onSelect,
  onWorldAction,
  onOneShotComplete,
}: WorldCanvasProps) {
  const { isTraditionalChinese } = useI18n()
  const hostRef = useRef<HTMLDivElement>(null)
  const runtimeRef = useRef<CanvasRuntime | null>(null)
  const localeRef = useRef(isTraditionalChinese)
  const worldRef = useRef(world)
  const toolRef = useRef(tool)
  const onSelectRef = useRef(onSelect)
  const onActionRef = useRef(onWorldAction)
  const onOneShotCompleteRef = useRef(onOneShotComplete)
  const fittedRef = useRef(false)
  const brushPointRef = useRef<PointerPosition | null>(null)

  worldRef.current = world
  localeRef.current = isTraditionalChinese
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
        resolution: Math.min(window.devicePixelRatio || 1, window.innerWidth < 440 ? 1.35 : window.innerWidth < 700 ? 1.5 : 2),
        background: 0x09140e,
        preference: 'webgl',
      })
      if (cancelled) {
        app.destroy(true)
        return
      }
      const terrainStyle = terrainStyleFromSearch(window.location.search)
      const creatureQaScene = speciesQaRequested(window.location.search)
      const creatureTextures = await loadCreatureTextures()
      app.canvas.setAttribute('aria-label', localeRef.current ? '互動式演化生態系統' : 'Interactive evolving ecosystem')
      app.canvas.setAttribute('role', 'application')
      app.canvas.setAttribute('aria-describedby', 'world-accessibility-summary')
      app.canvas.dataset.terrainStyle = terrainStyle
      host.appendChild(app.canvas)

      const viewport = new Container()
      const terrain = new Graphics()
      const plants = new Graphics()
      const creatures = new Container()
      const atmosphere = new Graphics()
      const social = new Graphics()
      const brush = new Graphics()
      viewport.addChild(terrain, plants, creatures, atmosphere, social, brush)
      app.stage.addChild(viewport)
      const runtime: CanvasRuntime = {
        app,
        viewport,
        terrain,
        plants,
        creatures,
        atmosphere,
        social,
        brush,
        creatureTextures,
        creatureQaScene,
        terrainRevision: -1,
        terrainStyle,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      }
      runtimeRef.current = runtime

      let sampledFrames = 0
      let sampleStartedAt = performance.now()
      const recordFrame = () => {
        sampledFrames += 1
        const now = performance.now()
        const elapsed = now - sampleStartedAt
        if (elapsed < 1_000) return
        canvas.dataset.fps = ((sampledFrames * 1_000) / elapsed).toFixed(1)
        sampledFrames = 0
        sampleStartedAt = now
      }
      app.ticker.add(recordFrame)

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
        app.ticker.remove(recordFrame)
        canvas.removeEventListener('pointerdown', onPointerDown)
        canvas.removeEventListener('pointermove', onPointerMove)
        canvas.removeEventListener('pointerup', onPointerUp)
        canvas.removeEventListener('pointercancel', onPointerUp)
        canvas.removeEventListener('wheel', onWheel)
        canvas.removeEventListener('pointerleave', onPointerLeave)
        window.removeEventListener('resize', onResize)
        terrain.cacheAsTexture(false)
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
    runtimeRef.current?.app.canvas.setAttribute(
      'aria-label',
      isTraditionalChinese ? '互動式演化生態系統' : 'Interactive evolving ecosystem',
    )
  }, [isTraditionalChinese])

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
    drawCreatures(
      runtime.creatures,
      world,
      selectedId,
      runtime.reducedMotion,
      runtime.creatureTextures,
      runtime.viewport.scale.x,
      runtime.app.canvas,
      runtime.creatureQaScene,
    )
    drawAtmosphere(runtime.atmosphere, world, runtime.reducedMotion)
    if (labMode) drawSocialLab(runtime.social, world)
    else runtime.social.clear()
  }, [labMode, selectedId, world])

  return <div className="world-canvas" ref={hostRef} />
}
