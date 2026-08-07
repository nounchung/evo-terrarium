import type { Creature, WorldState } from '../simulation/types'

interface SocialLabProps {
  world: WorldState
  selected: Creature | null
  onClose: () => void
  onInspectCreature: (id: number) => void
}

export function SocialLab({ world, selected, onClose, onInspectCreature }: SocialLabProps) {
  const activeMigrations = world.migrations.filter((record) => record.completedDay === null)
  const activeGroupIds = new Set(activeMigrations.map((record) => record.groupId))
  const displayedGroups = [...world.groups]
    .sort((first, second) => Number(activeGroupIds.has(second.id)) - Number(activeGroupIds.has(first.id)) || second.memberIds.length - first.memberIds.length)
    .slice(0, 6)
  const selectedGroup = selected?.groupId === null
    ? null
    : world.groups.find((group) => group.id === selected?.groupId) ?? null
  return (
    <aside className="social-lab" aria-label="Social behaviour lab">
      <header>
        <div><small>OPTIONAL DEBUG VIEW</small><h2>Social Lab</h2><p>Local rules, live—not scripted paths</p></div>
        <button type="button" onClick={onClose} aria-label="Close Social Lab">Close</button>
      </header>

      <div className="social-metrics">
        <div><strong>{world.groups.filter((group) => group.kind === 'grazer').length}</strong><span>herds</span></div>
        <div><strong>{world.groups.filter((group) => group.kind === 'hunter').length}</strong><span>packs</span></div>
        <div><strong>{world.territories.length}</strong><span>territories</span></div>
        <div><strong>{activeMigrations.length}</strong><span>routes</span></div>
      </div>

      <section>
        <div className="section-heading"><span>LIVE GROUPS</span><small>cohesion radius</small></div>
        <div className="group-list">
          {displayedGroups.map((group) => (
            <button key={group.id} type="button" onClick={() => onInspectCreature(group.leaderId)}>
              <i className={group.kind}/><span><strong>{group.name}</strong><small>{group.memberIds.length} members · {Math.round(group.radius)}u spread</small></span><em>#{group.leaderId}</em>
            </button>
          ))}
          {world.groups.length === 0 && <p>Groups form when enough nearby organisms repeatedly share local space.</p>}
        </div>
      </section>

      <section>
        <div className="section-heading"><span>MIGRATION EVIDENCE</span><small>resource-scored</small></div>
        <div className="migration-list">
          {[...world.migrations].reverse().slice(0, 4).map((record) => {
            const group = world.groups.find((candidate) => candidate.id === record.groupId)
            return <article key={record.id}><i/><div><strong>{group?.name ?? `Past group ${record.groupId}`}</strong><span>{record.reason} · {record.completedDay ? `completed day ${Math.floor(record.completedDay)}` : 'moving now'}</span></div></article>
          })}
          {world.migrations.length === 0 && <p>No route yet. A group migrates only when another reachable region scores better under resources, climate or threats.</p>}
        </div>
      </section>

      <section className="memory-debug">
        <div className="section-heading"><span>SELECTED MEMORY</span><small>{selected ? `#${selected.id}` : 'select an organism'}</small></div>
        {selected ? (
          <>
            <p>{selectedGroup ? `${selectedGroup.name} · ${selected.behaviour}` : `Ungrouped · ${selected.behaviour}`}</p>
            <div>{selected.memory.map((memory, index) => <span key={`${memory.kind}-${index}`} className={memory.kind}>{memory.kind}<small>{Math.max(0, 8 - (world.day - memory.recordedDay)).toFixed(1)}d</small></span>)}</div>
            {selected.memory.length === 0 && <small className="memory-empty">No useful place has been recorded yet.</small>}
          </>
        ) : <p>Click an organism while Lab Mode is open to inspect its six-slot spatial memory.</p>}
      </section>

      <footer><span><i className="herd"/>group cohesion</span><span><i className="territory"/>pack territory</span><span><i className="route"/>migration route</span></footer>
    </aside>
  )
}
