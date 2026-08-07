import type { CSSProperties } from 'react'
import type { SpeciesRecord, WorldState } from '../simulation/types'

interface SpeciesCodexProps {
  world: WorldState
  selectedId: number
  onSelect: (id: number) => void
  onClose: () => void
  onViewFounder: (id: number) => void
}

function trend(record: SpeciesRecord): { delta: number; days: number } {
  const history = record.populationHistory
  if (history.length < 2) return { delta: 0, days: 0 }
  const latest = history.at(-1)!
  const baseline = [...history].reverse().find((point) => latest.day - point.day >= 7) ?? history[0]
  return { delta: latest.population - baseline.population, days: Math.max(1, Math.round(latest.day - baseline.day)) }
}

function traitFacts(record: SpeciesRecord, world: WorldState): string[] {
  const peers = world.creatures.filter((creature) => creature.kind === record.kind)
  const average = (gene: keyof SpeciesRecord['signature']) => peers.length
    ? peers.reduce((total, creature) => total + creature.genes[gene], 0) / peers.length
    : record.signature[gene]
  const speedDelta = average('speed') ? (record.signature.speed / average('speed') - 1) * 100 : 0
  const visionDelta = average('vision') ? (record.signature.vision / average('vision') - 1) * 100 : 0
  const facts = [
    `Signature speed is ${Math.abs(speedDelta).toFixed(0)}% ${speedDelta >= 0 ? 'above' : 'below'} the living ${record.kind} average.`,
    `Signature vision is ${Math.abs(visionDelta).toFixed(0)}% ${visionDelta >= 0 ? 'above' : 'below'} the living ${record.kind} average.`,
  ]
  const deaths = world.stats.deathsByCause
  const leading = (Object.entries(deaths) as Array<[keyof typeof deaths, number]>)
    .sort((a, b) => b[1] - a[1])[0]
  if (leading && leading[1] > 0) {
    facts.push(`${leading[0][0].toUpperCase()}${leading[0].slice(1)} is the leading recorded death pressure (${leading[1]} lives).`)
  }
  if (world.stats.plants < 60) facts.push(`Only ${world.stats.plants} mature plants remain, increasing food competition.`)
  else facts.push(`${world.stats.plants} mature plants currently support the grazer food base.`)
  return facts
}

export function SpeciesCodex({
  world,
  selectedId,
  onSelect,
  onClose,
  onViewFounder,
}: SpeciesCodexProps) {
  const selected = world.species.find((record) => record.id === selectedId) ?? world.species[0]
  const parent = world.species.find((record) => record.id === selected.parentSpeciesId)
  const currentTrend = trend(selected)
  const livingSpecies = world.species.filter((record) => record.population > 0).length

  return (
    <aside className="species-codex glass" aria-label="Species codex">
      <header>
        <div><small>WORLD PAUSED · SPECIES CODEX</small><h2>{livingSpecies} living species</h2><p>Distinct lineages emerge when inherited traits move beyond the existing population.</p></div>
        <button type="button" onClick={onClose} aria-label="Close species codex">Close</button>
      </header>

      <div className="species-layout">
        <nav aria-label="Recorded species">
          {world.species.map((record) => {
            const recordTrend = trend(record)
            const style = { '--species-hue': `${record.signature.hue}deg` } as CSSProperties
            return (
              <button key={record.id} type="button" className={`${selected.id === record.id ? 'active' : ''} ${record.extinctDay ? 'extinct' : ''}`} style={style} onClick={() => onSelect(record.id)}>
                <i className={record.kind} aria-hidden="true"/><span><small>{record.kind.toUpperCase()} · S{record.id}</small><strong>{record.name}</strong><em>{record.population} living · {recordTrend.delta >= 0 ? '+' : ''}{recordTrend.delta}</em></span>
              </button>
            )
          })}
        </nav>

        <section className="species-profile" aria-label={`Species profile for ${selected.name}`}>
          <div className="species-hero">
            <span className={`species-emblem ${selected.kind}`} style={{ '--species-hue': `${selected.signature.hue}deg` } as CSSProperties}/>
            <div><small>{selected.kind.toUpperCase()} · SPECIES {selected.id}</small><h3>{selected.name}</h3><p>{selected.extinctDay ? `Extinct on day ${Math.floor(selected.extinctDay)}` : `Living since day ${Math.floor(selected.emergedDay)}`}</p></div>
          </div>

          <div className="species-metrics">
            <div><small>POPULATION</small><strong>{selected.population}</strong><span>{currentTrend.delta >= 0 ? '+' : ''}{currentTrend.delta} over {currentTrend.days || 1}d</span></div>
            <div><small>PEAK</small><strong>{selected.peakPopulation}</strong><span>living at once</span></div>
            <div><small>ORIGIN</small><strong>Day {Math.floor(selected.emergedDay)}</strong><span>{parent ? `from ${parent.name}` : 'founding species'}</span></div>
          </div>

          <section className="species-facts">
            <div className="lineage-heading"><h3>Selection evidence</h3><span>facts from this world</span></div>
            <ul>{traitFacts(selected, world).map((fact) => <li key={fact}>{fact}</li>)}</ul>
          </section>

          <section className="species-signature">
            <div className="lineage-heading"><h3>Genetic signature</h3><span>founding values</span></div>
            <div>
              <span>Speed <strong>{selected.signature.speed.toFixed(0)}</strong></span>
              <span>Vision <strong>{selected.signature.vision.toFixed(0)}</strong></span>
              <span>Size <strong>{selected.signature.size.toFixed(2)}</strong></span>
              <span>Efficiency <strong>{(2 - selected.signature.metabolism).toFixed(2)}</strong></span>
            </div>
          </section>

          {selected.founderId && world.creatures.some((creature) => creature.id === selected.founderId) && (
            <button className="founder-action" type="button" onClick={() => onViewFounder(selected.founderId!)}>Inspect living founder #{selected.founderId}</button>
          )}
        </section>
      </div>
    </aside>
  )
}
