import type { Behaviour, Creature, CreatureKind, WorldState } from '../simulation/types'

export type LifeStage = 'juvenile' | 'adult' | 'older'
export type CreatureDetail = 'full' | 'reduced'

export interface BehaviourPose {
  rotation: number
  scaleX: number
  scaleY: number
  offsetX: number
  offsetY: number
  cue: 'none' | 'food' | 'water' | 'threat' | 'prey' | 'bond' | 'rest' | 'route'
  showTrail: boolean
}

export const RECOGNISABLE_BEHAVIOURS: Behaviour[] = [
  'forage',
  'hunt',
  'flee',
  'rest',
  'mate',
  'drink',
  'migrate',
]

export function lifeStageFor(creature: Pick<Creature, 'age' | 'maxAge'>): LifeStage {
  const ratio = creature.maxAge <= 0 ? 0 : creature.age / creature.maxAge
  if (ratio < 0.2) return 'juvenile'
  if (ratio >= 0.76) return 'older'
  return 'adult'
}

export function lifeStageScale(stage: LifeStage): number {
  if (stage === 'juvenile') return 0.7
  if (stage === 'older') return 1.06
  return 1
}

export function behaviourPoseFor(
  behaviour: Behaviour,
  kind: CreatureKind,
  phase: number,
  reducedMotion: boolean,
): BehaviourPose {
  const bob = reducedMotion ? 0 : Math.sin(phase) * (kind === 'hunter' ? 1.05 : 0.72)
  switch (behaviour) {
    case 'forage':
      return { rotation: 0.16, scaleX: 0.98, scaleY: 0.86, offsetX: 2, offsetY: 4, cue: 'food', showTrail: false }
    case 'drink':
      return { rotation: 0.24, scaleX: 0.96, scaleY: 0.82, offsetX: 3, offsetY: 5, cue: 'water', showTrail: false }
    case 'hunt':
      return { rotation: -0.08, scaleX: 1.14, scaleY: 0.82, offsetX: 4, offsetY: 2 + bob * 0.25, cue: 'prey', showTrail: !reducedMotion }
    case 'flee':
      return { rotation: -0.13, scaleX: 1.18, scaleY: 0.87, offsetX: 5, offsetY: bob, cue: 'threat', showTrail: !reducedMotion }
    case 'mate':
      return { rotation: -0.04, scaleX: 1, scaleY: 1, offsetX: 0, offsetY: bob * 0.3, cue: 'bond', showTrail: false }
    case 'rest':
      return { rotation: 0.03, scaleX: 1.04, scaleY: 0.7, offsetX: 0, offsetY: 7, cue: 'rest', showTrail: false }
    case 'migrate':
      return { rotation: -0.05, scaleX: 1.08, scaleY: 0.92, offsetX: 3, offsetY: bob, cue: 'route', showTrail: !reducedMotion }
    default:
      return { rotation: 0, scaleX: 1, scaleY: 1, offsetX: 0, offsetY: bob * 0.5, cue: 'none', showTrail: false }
  }
}

export function creatureDetailFor(population: number, zoom: number): CreatureDetail {
  return population > 115 || zoom < 0.58 ? 'reduced' : 'full'
}

export function speciesQaRequested(search: string): boolean {
  return new URLSearchParams(search).get('r9qa') === 'species'
}

function qaCreature(
  template: Creature,
  id: number,
  kind: CreatureKind,
  behaviour: Behaviour,
  stage: LifeStage,
  x: number,
  y: number,
): Creature {
  const ageRatio = stage === 'juvenile' ? 0.12 : stage === 'older' ? 0.84 : 0.43
  return {
    ...template,
    id,
    kind,
    species: kind === 'grazer' ? 'Moss deer' : 'Ember stalker',
    x,
    y,
    angle: 0,
    behaviour,
    age: template.maxAge * ageRatio,
    targetX: x + 80,
    targetY: y,
    mutations: id % 3 === 0 ? [{ gene: 'hue', inheritedValue: 0, value: 12, changePercent: 12, significant: true }] : [],
  }
}

export function creaturesForRendering(world: WorldState, qaScene: boolean, compact = false): Creature[] {
  if (!qaScene) return world.creatures
  const grazer = world.creatures.find((creature) => creature.kind === 'grazer')
  const hunter = world.creatures.find((creature) => creature.kind === 'hunter')
  if (!grazer || !hunter) return world.creatures
  const stages: LifeStage[] = ['juvenile', 'adult', 'older', 'adult']
  const top: Behaviour[] = ['forage', 'drink', 'rest', 'mate']
  const bottom: Behaviour[] = ['hunt', 'flee', 'migrate']
  if (compact) {
    const slots = [
      { x: 625, y: 210 },
      { x: 815, y: 210 },
      { x: 625, y: 390 },
      { x: 815, y: 390 },
      { x: 625, y: 570 },
      { x: 815, y: 570 },
      { x: 720, y: 735 },
    ]
    return [
      ...top.map((behaviour, index) => qaCreature(
        grazer,
        -101 - index,
        'grazer',
        behaviour,
        stages[index],
        slots[index].x,
        slots[index].y,
      )),
      ...bottom.map((behaviour, index) => qaCreature(
        hunter,
        -201 - index,
        'hunter',
        behaviour,
        stages[index],
        slots[index + 4].x,
        slots[index + 4].y,
      )),
    ]
  }
  const columns = [410, 620, 830, 1040]
  return [
    ...top.map((behaviour, index) => qaCreature(grazer, -101 - index, 'grazer', behaviour, stages[index], columns[index], 315)),
    ...bottom.map((behaviour, index) => qaCreature(hunter, -201 - index, 'hunter', behaviour, stages[index], columns[index] + 90, 590)),
  ]
}
