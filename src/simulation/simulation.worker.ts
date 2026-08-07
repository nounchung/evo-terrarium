/// <reference lib="webworker" />

import { SimulationEngine } from './engine'
import type { SimSpeed, WorkerCommand, WorkerMessage, WorldState } from './types'

const context: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope
const FIXED_STEP = 0.05
const SNAPSHOT_INTERVAL = 100

let engine: SimulationEngine | null = null
let speed: SimSpeed = 1
let accumulator = 0
let previousTime = performance.now()
let previousSnapshot = 0
let replaySource: WorldState | null = null

function send(type: WorkerMessage['type']): void {
  if (!engine) return
  const message: WorkerMessage = {
    type,
    world: engine.snapshot(),
    speed,
    canUndo: replaySource ? false : engine.canUndo(),
    replay: {
      active: replaySource !== null,
      currentTick: engine.state.tick,
      maxTick: replaySource?.tick ?? engine.state.tick,
    },
  }
  context.postMessage(message)
}

context.addEventListener('message', (event: MessageEvent<WorkerCommand>) => {
  const command = event.data
  if (command.type === 'init') {
    engine = new SimulationEngine(command.seed, command.restored)
    replaySource = null
    accumulator = 0
    previousTime = performance.now()
    send('ready')
    return
  }
  if (command.type === 'reset') {
    engine = new SimulationEngine(command.seed)
    replaySource = null
    accumulator = 0
    send('ready')
    return
  }
  if (command.type === 'restore') {
    engine = new SimulationEngine(command.world.seed, command.world)
    replaySource = null
    accumulator = 0
    speed = 0
    send('ready')
    return
  }
  if (command.type === 'speed') {
    speed = command.speed
    return
  }
  if (command.type === 'snapshot') {
    send('snapshot')
    return
  }
  if (command.type === 'undo') {
    if (replaySource) return
    engine?.undoWorldAction()
    send('snapshot')
    return
  }
  if (command.type === 'world-action' && engine) {
    if (replaySource) return
    engine.applyWorldAction(command.action, command.x, command.y, command.radius)
    send('snapshot')
    return
  }
  if (command.type === 'replay-seek' && engine) {
    replaySource ??= engine.snapshot()
    const targetTick = Math.min(replaySource.tick, Math.max(0, Math.floor(command.tick)))
    engine = SimulationEngine.replay(replaySource.seed, replaySource.actionLog, targetTick)
    accumulator = 0
    speed = 0
    send('snapshot')
    return
  }
  if (command.type === 'replay-exit' && replaySource) {
    engine = new SimulationEngine(replaySource.seed, replaySource)
    replaySource = null
    accumulator = 0
    speed = 0
    send('ready')
  }
})

setInterval(() => {
  const now = performance.now()
  const elapsed = Math.min(0.12, (now - previousTime) / 1000)
  previousTime = now
  if (engine && speed > 0) {
    accumulator += elapsed * speed
    let steps = 0
    while (accumulator >= FIXED_STEP && steps < 120) {
      const replayContinues = replaySource
        ? engine.stepReplay(FIXED_STEP, replaySource.tick)
        : (engine.step(FIXED_STEP), true)
      accumulator -= FIXED_STEP
      steps += 1
      if (!replayContinues) {
        speed = 0
        accumulator = 0
        send('snapshot')
        break
      }
    }
  }
  if (engine && now - previousSnapshot >= SNAPSHOT_INTERVAL) {
    previousSnapshot = now
    send('snapshot')
  }
}, 32)
