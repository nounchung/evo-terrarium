function hashSeed(seed: string): number {
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export class SeededRandom {
  public state: number

  constructor(seedOrState: string | number) {
    this.state =
      typeof seedOrState === 'string' ? hashSeed(seedOrState) : seedOrState >>> 0
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let value = this.state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }

  integer(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  chance(probability: number): boolean {
    return this.next() < probability
  }
}

export function coordinateNoise(seed: string, x: number, y: number): number {
  return new SeededRandom(`${seed}:${x}:${y}`).next()
}

