import { Graphics } from 'pixi.js'
import type { DisasterType, WorldState } from '../simulation/types'

const DISASTER_COLOURS: Record<DisasterType, number> = {
  drought: 0xd8b66b,
  flood: 0x73b9c2,
  disease: 0xbd86ca,
  wildfire: 0xdc7258,
}

export function drawAtmosphere(graphic: Graphics, world: WorldState, reducedMotion: boolean): void {
  graphic.clear()
  const seasonTint = {
    'new-growth': 0x9dcf7d,
    'high-sun': 0xe7bd70,
    amberfall: 0xd48a59,
    'long-rain': 0x70a9b3,
  }[world.climate.season]
  const seasonAlpha = world.climate.season === 'amberfall' ? 0.032 : 0.022
  graphic.rect(0, 0, world.width, world.height).fill({ color: seasonTint, alpha: seasonAlpha })
  if (world.climate.dayPhase === 'dawn' || world.climate.dayPhase === 'dusk') {
    graphic.rect(0, 0, world.width, world.height).fill({ color: 0xd78158, alpha: world.climate.dayPhase === 'dusk' ? 0.055 : 0.038 })
  }
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
  if (world.climate.dayPhase === 'night') {
    for (let index = 0; index < 16; index += 1) {
      const x = 35 + ((index * 317) % Math.max(80, world.width - 70))
      const y = 40 + ((index * 173) % Math.max(80, world.height - 120))
      const pulse = reducedMotion ? 0.42 : 0.27 + (Math.sin(world.tick * 0.12 + index * 1.7) + 1) * 0.16
      graphic.circle(x, y, index % 3 === 0 ? 1.8 : 1.2).fill({ color: 0xdfe99b, alpha: pulse })
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

