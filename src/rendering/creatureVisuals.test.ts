import { describe, expect, it } from 'vitest'
import type { Creature, WorldState } from '../simulation/types'
import {
  behaviourPoseFor,
  creatureDetailFor,
  creaturesForRendering,
  lifeStageFor,
  speciesQaRequested,
} from './creatureVisuals'

describe('R9.2 creature visuals', () => {
  it('maps age ratios into stable life stages', () => {
    expect(lifeStageFor({ age: 3, maxAge: 40 })).toBe('juvenile')
    expect(lifeStageFor({ age: 20, maxAge: 40 })).toBe('adult')
    expect(lifeStageFor({ age: 34, maxAge: 40 })).toBe('older')
  })

  it('gives high-motion behaviours a distinct stretched posture', () => {
    expect(behaviourPoseFor('flee', 'grazer', 0, false).scaleX).toBeGreaterThan(1.1)
    expect(behaviourPoseFor('hunt', 'hunter', 0, false).cue).toBe('prey')
  })

  it('keeps state cues but removes decorative trails for reduced motion', () => {
    const pose = behaviourPoseFor('migrate', 'grazer', 1.7, true)
    expect(pose.cue).toBe('route')
    expect(pose.showTrail).toBe(false)
    expect(pose.offsetY).toBe(0)
  })

  it('simplifies only distant or very dense populations', () => {
    expect(creatureDetailFor(80, 0.9)).toBe('full')
    expect(creatureDetailFor(116, 0.9)).toBe('reduced')
    expect(creatureDetailFor(80, 0.5)).toBe('reduced')
  })

  it('enables the renderer-only QA scene without changing the world', () => {
    expect(speciesQaRequested('?r9qa=species')).toBe(true)
    expect(speciesQaRequested('?seed=MOSS-1738')).toBe(false)
  })

  it('keeps all seven compact QA creatures inside the mobile safe playfield', () => {
    const creature = (id: number, kind: Creature['kind']) => ({
      id,
      kind,
      speciesId: 1,
      species: kind,
      x: 0,
      y: 0,
      angle: 0,
      age: 5,
      maxAge: 40,
      behaviour: 'rest',
      genes: { speed: 40, size: 1, vision: 100, hue: 0, metabolism: 1, fertility: 1 },
      mutations: [],
    }) as unknown as Creature
    const world = {
      creatures: [creature(1, 'grazer'), creature(2, 'hunter')],
    } as WorldState

    const compact = creaturesForRendering(world, true, true)

    expect(compact).toHaveLength(7)
    expect(Math.min(...compact.map(({ y }) => y))).toBeGreaterThanOrEqual(285)
    expect(Math.max(...compact.map(({ y }) => y))).toBeLessThanOrEqual(645)
  })
})
