import { describe, expect, it } from 'vitest'
import { SimulationEngine } from './engine'
import { parseWorldRecord, seedShareUrl, serializeWorldRecord } from './records'

describe('portable world records', () => {
  it('round-trips a versioned world without losing replay data', () => {
    const engine = new SimulationEngine('ARCHIVE-7712')
    for (let step = 0; step < 40; step += 1) engine.step(0.05)
    const creature = engine.state.creatures[0]
    engine.applyWorldAction('grazer', creature.x, creature.y)

    const parsed = parseWorldRecord(serializeWorldRecord('Amber field notes', engine.snapshot()))

    expect(parsed.name).toBe('Amber field notes')
    expect(parsed.world).toEqual(engine.snapshot())
    expect(parsed.world.actionLog).toHaveLength(1)
  })

  it('rejects malformed or incompatible files', () => {
    expect(() => parseWorldRecord('{bad json')).toThrow('valid JSON')
    expect(() => parseWorldRecord(JSON.stringify({ app: 'another-app', formatVersion: 1 }))).toThrow('not supported')
    expect(() => parseWorldRecord(JSON.stringify({ app: 'evo-terrarium', formatVersion: 1, name: 'Broken', world: {} }))).toThrow('incomplete')
  })

  it('creates a clean seed URL that reproduces the founding world', () => {
    expect(seedShareUrl('MOSS-1738', 'https://example.test/world?old=1#panel'))
      .toBe('https://example.test/world?seed=MOSS-1738')
  })
})
