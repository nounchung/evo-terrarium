/// <reference lib="webworker" />

import { SimulationEngine } from './engine'
import type { SimSpeed, WorkerCommand, WorkerMessage } from './types'

const context: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope
const FIXED_STEP = 0.05
const SNAPSHOT_INTERVAL = 100

let engine: SimulationEngine | null = null
let speed: SimSpeed = 1
let accumulator = 0
let previousTime = performance.now()
let previousSnapshot = 0

function send(type: WorkerMessage['type']): void {
  if (!engine) return
  const message: WorkerMessage =
    type === 'ready'
      ? { type, world: engine.snapshot(), canUndo: engine.canUndo() }
      : { type, world: engine.snapshot(), speed, canUndo: engine.canUndo() }
  context.postMessage(message)
}

context.addEventListener('message', (event: MessageEvent<WorkerCommand>) => {
  const command = event.data
  if (command.type === 'init') {
    engine = new SimulationEngine(command.seed, command.restored)
    accumulator = 0
    previousTime = performance.now()
    send('ready')
    return
  }
  if (command.type === 'reset') {
    engine = new SimulationEngine(command.seed)
    accumulator = 0
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
    engine?.undoWorldAction()
    send('snapshot')
    return
  }
  if (command.type === 'world-action' && engine) {
    engine.applyWorldAction(command.action, command.x, command.y, command.radius)
    send('snapshot')
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
      engine.step(FIXED_STEP)
      accumulator -= FIXED_STEP
      steps += 1
    }
  }
  if (engine && now - previousSnapshot >= SNAPSHOT_INTERVAL) {
    previousSnapshot = now
    send('snapshot')
  }
}, 32)
