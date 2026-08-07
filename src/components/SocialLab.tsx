import { localizeBehaviour, localizeGeneratedName, localizeMemory, localizeMigrationReason, useI18n } from '../i18n'
import type { Creature, WorldState } from '../simulation/types'

interface SocialLabProps {
  world: WorldState
  selected: Creature | null
  onClose: () => void
  onInspectCreature: (id: number) => void
}

export function SocialLab({ world, selected, onClose, onInspectCreature }: SocialLabProps) {
  const { locale, isTraditionalChinese } = useI18n()
  const activeMigrations = world.migrations.filter((record) => record.completedDay === null)
  const activeGroupIds = new Set(activeMigrations.map((record) => record.groupId))
  const displayedGroups = [...world.groups]
    .sort((first, second) => Number(activeGroupIds.has(second.id)) - Number(activeGroupIds.has(first.id)) || second.memberIds.length - first.memberIds.length)
    .slice(0, 6)
  const selectedGroup = selected?.groupId === null
    ? null
    : world.groups.find((group) => group.id === selected?.groupId) ?? null
  return (
    <aside className="social-lab" aria-label={isTraditionalChinese ? '社會行為實驗室' : 'Social behaviour lab'}>
      <header>
        <div><small>{isTraditionalChinese ? '可選除錯檢視' : 'OPTIONAL DEBUG VIEW'}</small><h2>{isTraditionalChinese ? '社會實驗室' : 'Social Lab'}</h2><p>{isTraditionalChinese ? '即時局部規則，而非預設路線' : 'Local rules, live—not scripted paths'}</p></div>
        <button type="button" onClick={onClose} aria-label={isTraditionalChinese ? '關閉社會實驗室' : 'Close Social Lab'}>{isTraditionalChinese ? '關閉' : 'Close'}</button>
      </header>

      <div className="social-metrics">
        <div><strong>{world.groups.filter((group) => group.kind === 'grazer').length}</strong><span>{isTraditionalChinese ? '個獸群' : 'herds'}</span></div>
        <div><strong>{world.groups.filter((group) => group.kind === 'hunter').length}</strong><span>{isTraditionalChinese ? '個獵群' : 'packs'}</span></div>
        <div><strong>{world.territories.length}</strong><span>{isTraditionalChinese ? '個領域' : 'territories'}</span></div>
        <div><strong>{activeMigrations.length}</strong><span>{isTraditionalChinese ? '條路線' : 'routes'}</span></div>
      </div>

      <section>
        <div className="section-heading"><span>{isTraditionalChinese ? '現存群體' : 'LIVE GROUPS'}</span><small>{isTraditionalChinese ? '凝聚半徑' : 'cohesion radius'}</small></div>
        <div className="group-list">
          {displayedGroups.map((group) => (
            <button key={group.id} type="button" onClick={() => onInspectCreature(group.leaderId)}>
              <i className={group.kind}/><span><strong>{localizeGeneratedName(group.name, locale)}</strong><small>{group.memberIds.length} {isTraditionalChinese ? `名成員 · 分布 ${Math.round(group.radius)} 單位` : `members · ${Math.round(group.radius)}u spread`}</small></span><em>#{group.leaderId}</em>
            </button>
          ))}
          {world.groups.length === 0 && <p>{isTraditionalChinese ? '當足夠多的鄰近生物持續共用局部空間，便會形成群體。' : 'Groups form when enough nearby organisms repeatedly share local space.'}</p>}
        </div>
      </section>

      <section>
        <div className="section-heading"><span>{isTraditionalChinese ? '遷徙證據' : 'MIGRATION EVIDENCE'}</span><small>{isTraditionalChinese ? '按資源評分' : 'resource-scored'}</small></div>
        <div className="migration-list">
          {[...world.migrations].reverse().slice(0, 4).map((record) => {
            const group = world.groups.find((candidate) => candidate.id === record.groupId)
            return <article key={record.id}><i/><div><strong>{group ? localizeGeneratedName(group.name, locale) : (isTraditionalChinese ? `過往群體 ${record.groupId}` : `Past group ${record.groupId}`)}</strong><span>{localizeMigrationReason(record.reason, locale)} · {record.completedDay ? (isTraditionalChinese ? `於第 ${Math.floor(record.completedDay)} 日完成` : `completed day ${Math.floor(record.completedDay)}`) : (isTraditionalChinese ? '正在移動' : 'moving now')}</span></div></article>
          })}
          {world.migrations.length === 0 && <p>{isTraditionalChinese ? '尚未有路線。只有當另一個可達區域在資源、氣候或威脅方面評分更高，群體才會遷徙。' : 'No route yet. A group migrates only when another reachable region scores better under resources, climate or threats.'}</p>}
        </div>
      </section>

      <section className="memory-debug">
        <div className="section-heading"><span>{isTraditionalChinese ? '所選個體的記憶' : 'SELECTED MEMORY'}</span><small>{selected ? `#${selected.id}` : (isTraditionalChinese ? '選擇一個生物' : 'select an organism')}</small></div>
        {selected ? (
          <>
            <p>{selectedGroup ? `${localizeGeneratedName(selectedGroup.name, locale)} · ${localizeBehaviour(selected.behaviour, locale)}` : `${isTraditionalChinese ? '未加入群體' : 'Ungrouped'} · ${localizeBehaviour(selected.behaviour, locale)}`}</p>
            <div>{selected.memory.map((memory, index) => <span key={`${memory.kind}-${index}`} className={memory.kind}>{localizeMemory(memory.kind, locale)}<small>{Math.max(0, 8 - (world.day - memory.recordedDay)).toFixed(1)}{isTraditionalChinese ? '日' : 'd'}</small></span>)}</div>
            {selected.memory.length === 0 && <small className="memory-empty">{isTraditionalChinese ? '尚未記錄任何有用地點。' : 'No useful place has been recorded yet.'}</small>}
          </>
        ) : <p>{isTraditionalChinese ? '在實驗室模式開啟時點選生物，即可查看牠的六格空間記憶。' : 'Click an organism while Lab Mode is open to inspect its six-slot spatial memory.'}</p>}
      </section>

      <footer><span><i className="herd"/>{isTraditionalChinese ? '群體凝聚' : 'group cohesion'}</span><span><i className="territory"/>{isTraditionalChinese ? '獵群領域' : 'pack territory'}</span><span><i className="route"/>{isTraditionalChinese ? '遷徙路線' : 'migration route'}</span></footer>
    </aside>
  )
}
