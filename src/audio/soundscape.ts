import type { WorldEvent, WorldState } from '../simulation/types'

export interface SoundscapeProfile {
  water: number
  wind: number
  life: number
  night: number
  tension: number
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export function soundscapeProfile(world: WorldState): SoundscapeProfile {
  const waterCells = world.terrain.reduce(
    (total, biome) => total + (biome === 'water' || biome === 'deep-water' ? 1 : 0),
    0,
  )
  const waterShare = world.terrain.length > 0 ? waterCells / world.terrain.length : 0
  const population = world.stats.grazers + world.stats.hunters
  const activeDisaster = world.disasters.reduce(
    (highest, disaster) => world.day < disaster.endsDay ? Math.max(highest, disaster.intensity) : highest,
    0,
  )
  const seasonalWind = world.climate.season === 'long-rain'
    ? 0.22
    : world.climate.season === 'amberfall' ? 0.12 : 0

  return {
    water: clamp01(0.1 + waterShare * 2.4 + world.climate.rainfall * 0.24),
    wind: clamp01(0.12 + world.climate.rainfall * 0.52 + seasonalWind),
    life: clamp01(population / 170),
    night: clamp01(1 - world.climate.daylight),
    tension: clamp01(activeDisaster * 0.8 + (world.stats.status === 'fragile' ? 0.3 : world.stats.status === 'stressed' ? 0.14 : 0)),
  }
}

type AudioContextConstructor = typeof AudioContext

function contextConstructor(): AudioContextConstructor | null {
  const candidate = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext
  return candidate ?? null
}

function createNoise(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let index = 0; index < data.length; index += 1) {
    data[index] = Math.random() * 2 - 1
  }
  return buffer
}

function ramp(parameter: AudioParam, value: number, context: AudioContext): void {
  parameter.cancelScheduledValues(context.currentTime)
  parameter.setValueAtTime(parameter.value, context.currentTime)
  parameter.linearRampToValueAtTime(value, context.currentTime + 0.65)
}

export class ProceduralSoundscape {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private waterGain: GainNode | null = null
  private windGain: GainNode | null = null
  private lifeGain: GainNode | null = null
  private lifeOscillator: OscillatorNode | null = null
  private lastEventId: number | null = null

  async start(world: WorldState): Promise<boolean> {
    if (this.context) {
      await this.context.resume()
      this.update(world)
      return true
    }
    const Context = contextConstructor()
    if (!Context) return false

    const context = new Context()
    const master = context.createGain()
    master.gain.value = 0.72
    master.connect(context.destination)

    const noise = createNoise(context)
    const waterSource = context.createBufferSource()
    const waterFilter = context.createBiquadFilter()
    const waterGain = context.createGain()
    waterSource.buffer = noise
    waterSource.loop = true
    waterFilter.type = 'lowpass'
    waterFilter.frequency.value = 680
    waterFilter.Q.value = 0.65
    waterGain.gain.value = 0
    waterSource.connect(waterFilter).connect(waterGain).connect(master)
    waterSource.start()

    const windSource = context.createBufferSource()
    const windFilter = context.createBiquadFilter()
    const windGain = context.createGain()
    windSource.buffer = noise
    windSource.loop = true
    windFilter.type = 'bandpass'
    windFilter.frequency.value = 1250
    windFilter.Q.value = 0.5
    windGain.gain.value = 0
    windSource.connect(windFilter).connect(windGain).connect(master)
    windSource.start()

    const lifeOscillator = context.createOscillator()
    const lifeFilter = context.createBiquadFilter()
    const lifeGain = context.createGain()
    lifeOscillator.type = 'sine'
    lifeOscillator.frequency.value = 54
    lifeFilter.type = 'lowpass'
    lifeFilter.frequency.value = 110
    lifeGain.gain.value = 0
    lifeOscillator.connect(lifeFilter).connect(lifeGain).connect(master)
    lifeOscillator.start()

    this.context = context
    this.master = master
    this.waterGain = waterGain
    this.windGain = windGain
    this.lifeGain = lifeGain
    this.lifeOscillator = lifeOscillator
    this.lastEventId = world.events[0]?.id ?? null
    await context.resume()
    this.update(world)
    return true
  }

  update(world: WorldState): void {
    const context = this.context
    if (!context || !this.waterGain || !this.windGain || !this.lifeGain || !this.lifeOscillator) return
    const profile = soundscapeProfile(world)
    ramp(this.waterGain.gain, 0.012 + profile.water * 0.038, context)
    ramp(this.windGain.gain, 0.006 + profile.wind * 0.026 + profile.tension * 0.018, context)
    ramp(this.lifeGain.gain, 0.003 + profile.life * 0.01 + profile.night * 0.004, context)
    ramp(this.lifeOscillator.frequency, 48 + profile.life * 14 - profile.tension * 5, context)

    const latest = world.events[0]
    if (latest && this.lastEventId !== null && latest.id !== this.lastEventId) {
      this.playEvent(latest)
    }
    this.lastEventId = latest?.id ?? this.lastEventId
  }

  private playEvent(event: WorldEvent): void {
    const context = this.context
    const master = this.master
    if (!context || !master || context.state !== 'running') return
    const now = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const eventShape: Record<WorldEvent['kind'], [number, number, OscillatorType]> = {
      birth: [392, 523, 'sine'],
      death: [132, 82, 'triangle'],
      milestone: [330, 494, 'sine'],
      mutation: [440, 659, 'triangle'],
      player: [294, 392, 'sine'],
      speciation: [392, 784, 'sine'],
      disaster: [105, 58, 'sawtooth'],
      recovery: [262, 392, 'sine'],
      social: [330, 440, 'sine'],
      migration: [247, 330, 'triangle'],
    }
    const [from, to, type] = eventShape[event.kind]
    oscillator.type = type
    oscillator.frequency.setValueAtTime(from, now)
    oscillator.frequency.exponentialRampToValueAtTime(to, now + 0.45)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(event.kind === 'disaster' ? 0.036 : 0.025, now + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7)
    oscillator.connect(gain).connect(master)
    oscillator.start(now)
    oscillator.stop(now + 0.72)
  }

  async stop(): Promise<void> {
    const context = this.context
    this.context = null
    this.master = null
    this.waterGain = null
    this.windGain = null
    this.lifeGain = null
    this.lifeOscillator = null
    this.lastEventId = null
    if (context && context.state !== 'closed') await context.close()
  }
}
