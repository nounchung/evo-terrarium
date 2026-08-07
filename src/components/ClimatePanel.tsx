import type { DisasterType, WorldState } from '../simulation/types'

interface ClimatePanelProps {
  world: WorldState
  onClose: () => void
  onTrigger: (type: DisasterType) => void
}

const DISASTERS: Array<{ type: DisasterType; label: string; effect: string }> = [
  { type: 'drought', label: 'Drought', effect: 'Drains soil, plants and animal hydration.' },
  { type: 'flood', label: 'Flood', effect: 'Slows life, then leaves richer meadow.' },
  { type: 'disease', label: 'Disease', effect: 'Damages and pauses reproduction locally.' },
  { type: 'wildfire', label: 'Wildfire', effect: 'Burns plants and opens forest into grass.' },
]

const SEASON_LABELS: Record<WorldState['climate']['season'], string> = {
  'new-growth': 'New Growth',
  'high-sun': 'High Sun',
  amberfall: 'Amberfall',
  'long-rain': 'Long Rain',
}

export function ClimatePanel({ world, onClose, onTrigger }: ClimatePanelProps) {
  const active = world.disasters.filter((record) => world.day < record.endsDay)
  const latestRecovery = [...world.disasters].reverse().find((record) => record.recoveryNoted)
  return (
    <aside className="climate-panel" aria-label="Climate and disaster lab">
      <header>
        <div><small>LIVE ENVIRONMENT</small><h2>{SEASON_LABELS[world.climate.season]}</h2><p>{world.climate.dayPhase} · regional pressure lab</p></div>
        <button type="button" onClick={onClose} aria-label="Close climate lab">Close</button>
      </header>

      <div className="climate-metrics">
        <div><small>TEMPERATURE</small><strong>{world.climate.temperature.toFixed(1)}°</strong><span>{world.climate.temperature > 26 ? 'heat stress rising' : 'within mild range'}</span></div>
        <div><small>RAINFALL</small><strong>{Math.round(world.climate.rainfall * 100)}%</strong><span>{world.climate.rainfall > 0.62 ? 'rain is visible' : 'intermittent'}</span></div>
        <div><small>SOIL</small><strong>{Math.round(world.climate.soilMoisture)}%</strong><span>{world.climate.soilMoisture < 35 ? 'plant growth limited' : 'supports regrowth'}</span></div>
      </div>

      <section className="active-pressure">
        <div className="section-heading"><span>ACTIVE PRESSURES</span><small>{active.length || 'none'}</small></div>
        {active.length > 0 ? active.map((record) => (
          <article key={record.id}>
            <i className={record.type}/><div><strong>{record.type}</strong><span>{Math.max(0, record.endsDay - world.day).toFixed(1)} days remain · {record.affectedCells} cells</span></div>
          </article>
        )) : <p>No regional disaster is active. The seeded climate continues to change survival costs.</p>}
        {latestRecovery && <small className="recovery-note">Latest recovery: {latestRecovery.type} left {latestRecovery.affectedCells} habitat cells changed or depleted.</small>}
      </section>

      <section className="disaster-actions">
        <div className="section-heading"><span>INTRODUCE A PRESSURE</span><small>tap the world to place</small></div>
        <div>
          {DISASTERS.map((item) => (
            <button key={item.type} type="button" onClick={() => onTrigger(item.type)}>
              <i className={item.type}/><span><strong>{item.label}</strong><small>{item.effect}</small></span>
            </button>
          ))}
        </div>
      </section>
      <footer>Seed-driven events arrive deterministically. Player events use the same bounded rules and can be undone.</footer>
    </aside>
  )
}
