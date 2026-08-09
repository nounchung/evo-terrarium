import { Graphics } from 'pixi.js'
import type { WorldState } from '../simulation/types'

export function drawSocialLab(graphic: Graphics, world: WorldState): void {
  graphic.clear()
  for (const territory of world.territories) {
    graphic.circle(territory.x, territory.y, territory.radius).stroke({ color: 0xe59b76, width: 2, alpha: 0.28 + territory.pressure * 0.34 })
  }
  const migratingIds = new Set(world.migrations.filter((record) => record.completedDay === null).map((record) => record.groupId))
  const visibleGroups = [...world.groups]
    .sort((first, second) => Number(migratingIds.has(second.id)) - Number(migratingIds.has(first.id)) || second.memberIds.length - first.memberIds.length)
    .slice(0, 8)
  for (const group of visibleGroups) {
    const colour = group.kind === 'grazer' ? 0xd8e29a : 0xe98d70
    const displayRadius = Math.max(18, Math.min(72, group.radius * 0.48))
    graphic.circle(group.x, group.y, displayRadius).stroke({ color: colour, width: 1.7, alpha: 0.5 })
    graphic.circle(group.x, group.y, 4).fill({ color: colour, alpha: 0.9 })
  }
  const visibleMigrations = world.migrations
    .filter((migration) => migration.completedDay === null)
    .slice(-8)
  for (const migration of visibleMigrations) {
    graphic.moveTo(migration.from.x, migration.from.y).lineTo(migration.to.x, migration.to.y).stroke({ color: 0x8cd1c8, width: 3, alpha: 0.72 })
    graphic.circle(migration.to.x, migration.to.y, 11).stroke({ color: 0x8cd1c8, width: 2, alpha: 0.8 })
    graphic.circle(migration.to.x, migration.to.y, 3).fill({ color: 0x8cd1c8, alpha: 0.9 })
  }
}

