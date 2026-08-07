import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import './App.css'
import { WorldCanvas } from './components/WorldCanvas'
import { loadWorld, saveWorld } from './simulation/storage'
import type {
  CreationTool,
  SimSpeed,
  WorkerCommand,
  WorkerMessage,
  WorldState,
} from './simulation/types'

type IconName =
  | 'leaf'
  | 'cursor'
  | 'grass'
  | 'water'
  | 'forest'
  | 'plant'
  | 'grazer'
  | 'hunter'
  | 'pause'
  | 'play'
  | 'spark'
  | 'expand'
  | 'close'
  | 'seed'
  | 'chevron'
  | 'undo'

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    leaf: <><path d="M4 19C5 10 10 4 20 3c-1 10-6 15-15 16"/><path d="M5 19c4-5 8-8 13-11"/></>,
    cursor: <><path d="m5 3 14 8-6 2-2 6z"/><path d="m13 13 5 5"/></>,
    grass: <><path d="M5 20c1-7 3-11 6-15 0 6-1 11-2 15"/><path d="M10 20c2-6 5-9 9-12-2 5-3 8-4 12"/></>,
    water: <path d="M12 3s6 7 6 11a6 6 0 1 1-12 0c0-4 6-11 6-11Z"/>,
    forest: <><path d="m12 3-5 7h3l-5 7h14l-5-7h3z"/><path d="M12 17v4"/></>,
    plant: <><path d="M12 21V9"/><path d="M12 13C7 13 5 10 5 6c5 0 7 3 7 7Z"/><path d="M12 16c5 0 7-3 7-7-5 0-7 3-7 7Z"/></>,
    grazer: <><ellipse cx="11" cy="13" rx="7" ry="5"/><circle cx="18" cy="10" r="3"/><path d="m4 13-2-2m6 7v3m6-3v3"/></>,
    hunter: <><path d="m4 17 3-10 5 3 5-3 3 10-8 4z"/><path d="M9 14h.01M15 14h.01"/></>,
    pause: <><path d="M8 5v14M16 5v14"/></>,
    play: <path d="m8 5 11 7-11 7z"/>,
    spark: <><path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4z"/><path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6z"/></>,
    expand: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    seed: <><path d="M12 21V9"/><path d="M12 14c-5 0-7-3-7-7 5 0 7 3 7 7ZM12 11c4 0 6-2 6-6-4 0-6 2-6 6Z"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    undo: <><path d="M9 7 4 12l5 5"/><path d="M5 12h8a6 6 0 0 1 6 6"/></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  )
}

const TOOLS: Array<{ id: CreationTool; label: string; icon: IconName; tone?: string }> = [
  { id: 'inspect', label: 'Observe', icon: 'cursor' },
  { id: 'grass', label: 'Meadow', icon: 'grass', tone: 'meadow' },
  { id: 'water', label: 'Water', icon: 'water', tone: 'water' },
  { id: 'forest', label: 'Forest', icon: 'forest', tone: 'forest' },
  { id: 'plant', label: 'Grow plants', icon: 'plant', tone: 'plant' },
  { id: 'grazer', label: 'Add grazer', icon: 'grazer', tone: 'grazer' },
  { id: 'hunter', label: 'Add hunter', icon: 'hunter', tone: 'hunter' },
]

const SPEEDS: SimSpeed[] = [0, 1, 5, 20, 100]

function makeSeed(): string {
  const words = ['MOSS', 'FERN', 'TIDAL', 'AMBER', 'SPORE', 'CEDAR', 'WILD']
  return `${words[Math.floor(Math.random() * words.length)]}-${Math.floor(1000 + Math.random() * 9000)}`
}

function GeneBar({ label, value, min, max }: { label: string; value: number; min: number; max: number }) {
  const percentage = Math.max(4, Math.min(100, ((value - min) / (max - min)) * 100))
  return (
    <div className="gene-row">
      <span>{label}</span>
      <div className="gene-track"><i style={{ width: `${percentage}%` }} /></div>
      <strong>{Math.round(value)}</strong>
    </div>
  )
}

const BEHAVIOUR_COPY: Record<WorldState['creatures'][number]['behaviour'], string> = {
  wander: 'Exploring nearby habitat for its next opportunity.',
  forage: 'Seeking food because its energy reserve is falling.',
  drink: 'Heading to the shoreline because water is its most urgent need.',
  flee: 'Escaping a hunter it can currently perceive.',
  hunt: 'Tracking prey to restore its energy reserve.',
  mate: 'Seeking a compatible partner for the next generation.',
  rest: 'Conserving energy while no need is immediately critical.',
}

function App() {
  const [world, setWorld] = useState<WorldState | null>(null)
  const [speed, setSpeed] = useState<SimSpeed>(1)
  const [tool, setTool] = useState<CreationTool>('inspect')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [seedDialog, setSeedDialog] = useState(false)
  const [seedDraft, setSeedDraft] = useState('MOSS-1738')
  const [saved, setSaved] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  const worldRef = useRef<WorldState | null>(null)
  const dialogReturnSpeedRef = useRef<SimSpeed>(1)
  const toolReturnSpeedRef = useRef<SimSpeed>(1)

  worldRef.current = world
  const selected = useMemo(
    () => world?.creatures.find((creature) => creature.id === selectedId) ?? null,
    [selectedId, world],
  )

  useEffect(() => {
    const worker = new Worker(new URL('./simulation/simulation.worker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker
    worker.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
      setWorld(event.data.world)
      setCanUndo(event.data.canUndo)
      if (event.data.type === 'snapshot') setSpeed(event.data.speed)
    })
    void loadWorld().then((restored) => {
      const command: WorkerCommand = {
        type: 'init',
        seed: restored?.seed ?? 'MOSS-1738',
        restored,
      }
      setSeedDraft(command.seed)
      worker.postMessage(command)
    })
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const current = worldRef.current
      if (!current) return
      void saveWorld(current).then(() => {
        setSaved(true)
        window.setTimeout(() => setSaved(false), 1800)
      })
    }, 8000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedId && world && !world.creatures.some((creature) => creature.id === selectedId)) {
      setSelectedId(null)
    }
  }, [selectedId, world])

  const send = (command: WorkerCommand) => workerRef.current?.postMessage(command)
  const changeSpeed = (nextSpeed: SimSpeed) => {
    setSpeed(nextSpeed)
    send({ type: 'speed', speed: nextSpeed })
  }
  const createWorld = () => {
    const nextSeed = seedDraft.trim().toUpperCase() || makeSeed()
    setSeedDraft(nextSeed)
    setSelectedId(null)
    setTool('inspect')
    setSeedDialog(false)
    send({ type: 'reset', seed: nextSeed })
    changeSpeed(dialogReturnSpeedRef.current)
  }
  const openSeedDialog = () => {
    if (seedDialog) return
    dialogReturnSpeedRef.current = tool === 'inspect' ? speed : toolReturnSpeedRef.current
    setTool('inspect')
    setSeedDialog(true)
    changeSpeed(0)
  }
  const closeSeedDialog = () => {
    setSeedDialog(false)
    changeSpeed(dialogReturnSpeedRef.current)
  }
  const finishCreation = () => {
    setTool('inspect')
    changeSpeed(toolReturnSpeedRef.current)
  }
  const chooseTool = (nextTool: CreationTool) => {
    setSelectedId(null)
    if (nextTool === 'inspect') {
      if (tool !== 'inspect') finishCreation()
      return
    }
    if (tool === 'inspect') {
      toolReturnSpeedRef.current = speed
      changeSpeed(0)
    }
    setTool(nextTool)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (seedDialog) closeSeedDialog()
      else if (tool !== 'inspect') finishCreation()
      else if (selectedId !== null) setSelectedId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [seedDialog, selectedId, tool])
  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.()
  }

  const year = world ? Math.max(1, Math.floor(world.day / 28) + 1) : 1
  const day = world ? Math.max(1, Math.floor(world.day % 28) + 1) : 1
  const seasonNames = ['New Growth', 'High Sun', 'Amberfall', 'Long Rain']
  const season = world ? seasonNames[Math.floor(world.day / 7) % seasonNames.length] : 'New Growth'
  const population = (world?.stats.grazers ?? 0) + (world?.stats.hunters ?? 0)
  const foodWebLabel = world?.stats.status ?? 'balanced'
  const peers = selected
    ? world?.creatures.filter((creature) => creature.kind === selected.kind) ?? []
    : []
  const averagePeerSpeed = peers.length
    ? peers.reduce((total, creature) => total + creature.genes.speed, 0) / peers.length
    : 0
  const speedDifference = selected && averagePeerSpeed
    ? Math.round((selected.genes.speed / averagePeerSpeed - 1) * 100)
    : 0

  return (
    <main className={`terrarium ${tool !== 'inspect' ? 'is-creating' : ''}`}>
      <WorldCanvas
        world={world}
        selectedId={selectedId}
        tool={tool}
        onSelect={setSelectedId}
        onWorldAction={(action, x, y) => send({ type: 'world-action', action, x, y, radius: 58 })}
        onOneShotComplete={finishCreation}
      />

      <header className="topbar">
        <button className="brand glass" type="button" onClick={openSeedDialog} aria-label="Create a new world">
          <span className="brand-mark"><Icon name="leaf" size={20} /></span>
          <span><strong>EvoTerrarium</strong><small>Living world lab</small></span>
          <Icon name="chevron" size={14} />
        </button>

        <section className="world-stats glass" aria-label="World statistics">
          <div><span className="stat-dot grazer"/><strong>{world?.stats.grazers ?? '—'}</strong><small>Grazers</small></div>
          <div><span className="stat-dot hunter"/><strong>{world?.stats.hunters ?? '—'}</strong><small>Hunters</small></div>
          <div className="desktop-stat"><span className="stat-dot plant"/><strong>{world?.stats.plants ?? '—'}</strong><small>Plants</small></div>
          <div><Icon name="spark" size={15}/><strong>G{world?.stats.maxGeneration ?? 1}</strong><small>Generation</small></div>
        </section>

        <div className="top-actions">
          <span className={`save-state ${saved ? 'visible' : ''}`}>Saved</span>
          <button className="icon-button glass" type="button" onClick={fullscreen} aria-label="Toggle fullscreen"><Icon name="expand" /></button>
          <button className="new-world glass" type="button" onClick={openSeedDialog}><Icon name="seed"/><span>New world</span></button>
        </div>
      </header>

      <aside className="creation-palette glass" aria-label="Creation tools">
        <span className="palette-label">CREATE</span>
        {TOOLS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`${tool === item.id ? 'active' : ''} ${item.tone ?? ''}`}
            onClick={() => chooseTool(item.id)}
            aria-label={item.label}
            aria-pressed={tool === item.id}
          >
            <Icon name={item.icon} size={19}/><span>{item.label}</span>
            {index === 0 && <i className="palette-divider"/>}
          </button>
        ))}
      </aside>

      <section className="world-calendar glass">
        <div><small>YEAR {year}</small><strong>Day {day}</strong></div>
        <i/>
        <div><small>SEASON</small><strong>{season}</strong></div>
        <i/>
        <div className={`food-web ${foodWebLabel}`}><small>FOOD WEB</small><strong>{foodWebLabel}</strong></div>
        <span className="weather-orb" aria-hidden="true"/>
      </section>

      <aside className="event-feed" aria-label="Recent world events">
        {(world?.events ?? []).slice(0, 3).map((event, index) => (
          <article key={event.id} className={`event-card glass ${index > 1 ? 'minor' : ''}`}>
            <span className={`event-symbol ${event.kind}`}><Icon name={event.kind === 'death' ? 'hunter' : event.kind === 'player' ? 'seed' : 'spark'} size={15}/></span>
            <div><small>DAY {Math.floor(event.day)}</small><strong>{event.title}</strong><p>{event.detail}</p></div>
          </article>
        ))}
      </aside>

      {selected && (
        <aside className="creature-card glass" aria-label="Selected creature details">
          <button className="card-close" type="button" onClick={() => setSelectedId(null)} aria-label="Close creature details"><Icon name="close"/></button>
          <div className={`creature-avatar ${selected.kind}`}><Icon name={selected.kind === 'grazer' ? 'grazer' : 'hunter'} size={35}/><i/></div>
          <div className="creature-title"><small>{selected.kind.toUpperCase()} · #{selected.id}</small><h2>{selected.species}</h2><p>Generation {selected.generation} · {selected.behaviour}</p></div>
          <div className="creature-insight">
            <strong>{selected.behaviour === 'rest' ? 'Resting' : `${selected.behaviour[0].toUpperCase()}${selected.behaviour.slice(1)}`}</strong>
            <p>{BEHAVIOUR_COPY[selected.behaviour]}</p>
            <small>{Math.abs(speedDifference) < 3 ? 'Moves near the species average.' : `${Math.abs(speedDifference)}% ${speedDifference > 0 ? 'faster' : 'slower'} than its living peers.`}</small>
          </div>
          <div className="vitals">
            <div><span>ENERGY</span><strong>{Math.round(selected.energy)}%</strong><i><b style={{ width: `${selected.energy}%` }}/></i></div>
            <div className="hydration"><span>WATER</span><strong>{Math.round(selected.hydration)}%</strong><i><b style={{ width: `${selected.hydration}%` }}/></i></div>
            <div><span>HEALTH</span><strong>{Math.round(selected.health)}%</strong><i><b style={{ width: `${selected.health}%` }}/></i></div>
            <div><span>AGE</span><strong>{selected.age.toFixed(1)}d</strong><i><b style={{ width: `${Math.min(100, selected.age / selected.maxAge * 100)}%` }}/></i></div>
          </div>
          <div className="life-history" aria-label="Creature life history">
            <span><strong>{selected.meals}</strong> meals</span>
            <span><strong>{selected.drinks}</strong> drinks</span>
            {selected.kind === 'hunter' && <span><strong>{selected.kills}</strong> hunts</span>}
          </div>
          <div className="gene-panel">
            <div className="section-heading"><span>INHERITED TRAITS</span><small>{selected.parents ? '2 parents' : 'Founding life'}</small></div>
            <GeneBar label="Speed" value={selected.genes.speed} min={24} max={78}/>
            <GeneBar label="Vision" value={selected.genes.vision} min={55} max={240}/>
            <GeneBar label="Size" value={selected.genes.size * 100} min={58} max={170}/>
            <GeneBar label="Efficiency" value={(2 - selected.genes.metabolism) * 50} min={10} max={80}/>
          </div>
          <footer><span><strong>{selected.children.length}</strong> offspring</span><span>{selected.parents ? `Parents #${selected.parents.join(' · #')}` : 'First generation'}</span></footer>
        </aside>
      )}

      <section className="time-controls glass" aria-label="Simulation speed">
        {SPEEDS.map((value) => (
          <button key={value} type="button" className={speed === value ? 'active' : ''} onClick={() => changeSpeed(value)} aria-label={value === 0 ? 'Pause simulation' : `Run at ${value} times speed`}>
            {value === 0 ? <Icon name={speed === 0 ? 'play' : 'pause'} size={17}/> : `${value}×`}
          </button>
        ))}
        <span className="time-divider"/>
        <div className="population"><small>LIVING</small><strong>{population}</strong></div>
      </section>

      {tool !== 'inspect' && (
        <section className="tool-status glass" role="status" aria-live="polite">
          <span className={`tool-swatch ${tool}`}><Icon name={TOOLS.find((item) => item.id === tool)?.icon ?? 'cursor'} size={16}/></span>
          <div><small>WORLD PAUSED · CREATION TOOL</small><strong>{TOOLS.find((item) => item.id === tool)?.label}</strong><p>Tap to apply · Drag to explore · Esc to finish</p></div>
          <button type="button" onClick={() => send({ type: 'undo' })} disabled={!canUndo} aria-label="Undo last world change"><Icon name="undo" size={16}/><span>Undo</span></button>
          <button type="button" onClick={finishCreation}>Done</button>
        </section>
      )}

      <div className="gesture-hint"><span>{tool === 'inspect' ? 'Drag to explore · Pinch or scroll to zoom' : 'Tap to apply · Drag still moves the world'}</span></div>

      {!world && <div className="loading"><span className="loading-leaf"><Icon name="leaf" size={28}/></span><strong>Growing your world…</strong></div>}

      {seedDialog && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSeedDialog() }}>
          <section className="seed-dialog" role="dialog" aria-modal="true" aria-labelledby="seed-title">
            <button className="card-close" type="button" onClick={closeSeedDialog} aria-label="Close"><Icon name="close"/></button>
            <span className="dialog-mark"><Icon name="seed" size={25}/></span>
            <small>GENESIS LAB</small>
            <h2 id="seed-title">Begin another living world</h2>
            <p>A seed creates the same starting landscape. What happens next depends on life—and on you.</p>
            <label htmlFor="world-seed">WORLD SEED</label>
            <div className="seed-input"><Icon name="spark" size={17}/><input id="world-seed" value={seedDraft} onChange={(event) => setSeedDraft(event.target.value)} autoFocus/><button type="button" onClick={() => setSeedDraft(makeSeed())}>Randomise</button></div>
            <button className="begin-button" type="button" onClick={createWorld}>Grow this world <Icon name="chevron"/></button>
            <small className="dialog-note"><strong>World paused while choosing.</strong> Your current world is auto-saved on this device.</small>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
