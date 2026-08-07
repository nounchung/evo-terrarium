import { useEffect, useRef, useState } from 'react'
import type { SaveSlot } from '../simulation/storage'
import type { ReplayStatus, SimSpeed, WorldState } from '../simulation/types'

type ArchiveTab = 'saves' | 'replay' | 'share'

interface ArchivePanelProps {
  world: WorldState
  slots: SaveSlot[]
  replay: ReplayStatus
  notice: string
  onClose: () => void
  onSave: (name: string) => void
  onLoad: (slot: SaveSlot) => void
  onDelete: (slot: SaveSlot) => void
  onExport: (name: string, world: WorldState) => void
  onImport: (file: File) => void
  onCopySeed: () => void
  onSeek: (tick: number) => void
  onReplayExit: () => void
  onReplaySpeed: (speed: SimSpeed) => void
}

function dayLabel(day: number): string {
  const year = Math.max(1, Math.floor(day / 28) + 1)
  const cycleDay = Math.max(1, Math.floor(day % 28) + 1)
  return `Year ${year}, day ${cycleDay}`
}

export function ArchivePanel({
  world,
  slots,
  replay,
  notice,
  onClose,
  onSave,
  onLoad,
  onDelete,
  onExport,
  onImport,
  onCopySeed,
  onSeek,
  onReplayExit,
  onReplaySpeed,
}: ArchivePanelProps) {
  const [tab, setTab] = useState<ArchiveTab>('saves')
  const [name, setName] = useState(`World ${world.seed}`)
  const [targetTick, setTargetTick] = useState(world.tick)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTargetTick(replay.active ? replay.currentTick : world.tick)
  }, [replay.active, replay.currentTick, world.tick])

  const landmarks = [...world.landmarks].reverse().slice(0, 12)
  const maxTick = Math.max(1, replay.maxTick || world.tick)
  const targetDay = replay.active && targetTick === replay.currentTick
    ? world.day
    : 1 + targetTick * 0.006

  return (
    <aside className="archive-panel" aria-label="World archive">
      <header>
        <div>
          <small>VERSIONED WORLD RECORD</small>
          <h2>World Archive</h2>
          <p>Save, revisit and share this living history</p>
        </div>
        <button type="button" onClick={onClose}>Close</button>
      </header>

      <div className="archive-metrics">
        <div><strong>{slots.length}</strong><span>save slots</span></div>
        <div><strong>{world.actionLog.length}</strong><span>actions</span></div>
        <div><strong>{world.landmarks.length}</strong><span>landmarks</span></div>
      </div>

      <nav className="archive-tabs" aria-label="Archive sections">
        {(['saves', 'replay', 'share'] as ArchiveTab[]).map((item) => (
          <button key={item} type="button" className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
            {item === 'saves' ? 'Save slots' : item === 'replay' ? 'Replay' : 'Share'}
          </button>
        ))}
      </nav>

      {notice && <p className="archive-notice" role="status">{notice}</p>}

      {tab === 'saves' && (
        <section className="archive-section save-slots">
          <div className="section-heading"><span>NAME THIS MOMENT</span><small>{slots.length}/6 local slots</small></div>
          <div className="save-composer">
            <input aria-label="Save name" value={name} maxLength={48} onChange={(event) => setName(event.target.value)} />
            <button type="button" disabled={slots.length >= 6} onClick={() => onSave(name)}>Save</button>
          </div>
          <div className="slot-list">
            {slots.length === 0 && <p>No named saves yet. Preserve a world before a major experiment.</p>}
            {slots.map((slot) => (
              <article key={slot.id}>
                <div>
                  <strong>{slot.name}</strong>
                  <span>{dayLabel(slot.world.day)} · {slot.world.seed}</span>
                  <small>{new Date(slot.savedAt).toLocaleString()}</small>
                </div>
                <div>
                  <button type="button" onClick={() => onLoad(slot)}>Restore</button>
                  <button type="button" onClick={() => onExport(slot.name, slot.world)}>Export</button>
                  <button
                    className={`danger ${confirmDeleteId === slot.id ? 'confirming' : ''}`}
                    type="button"
                    onClick={() => {
                      if (confirmDeleteId === slot.id) {
                        onDelete(slot)
                        setConfirmDeleteId(null)
                      } else {
                        setConfirmDeleteId(slot.id)
                      }
                    }}
                  >
                    {confirmDeleteId === slot.id ? 'Confirm delete' : 'Delete'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'replay' && (
        <section className="archive-section replay-section">
          <div className="section-heading"><span>TIMELINE RECONSTRUCTION</span><small>seed + action log</small></div>
          <div className="replay-readout">
            <strong>{dayLabel(targetDay)}</strong>
            <span>tick {targetTick.toLocaleString()} / {maxTick.toLocaleString()}</span>
          </div>
          <input
            className="timeline-slider"
            aria-label="Replay timeline"
            type="range"
            min="0"
            max={maxTick}
            step={Math.max(1, Math.floor(maxTick / 240))}
            value={Math.min(targetTick, maxTick)}
            onChange={(event) => setTargetTick(Number(event.target.value))}
          />
          <div className="replay-actions">
            <button type="button" onClick={() => onSeek(targetTick)}>Rebuild here</button>
            {replay.active && <button type="button" onClick={() => onReplaySpeed(5)}>Play 5×</button>}
            {replay.active && <button type="button" onClick={() => onReplaySpeed(0)}>Pause</button>}
            {replay.active && <button className="secondary" type="button" onClick={onReplayExit}>Return live</button>}
          </div>
          <div className="landmark-list">
            <div className="section-heading"><span>ECOLOGICAL LANDMARKS</span><small>{landmarks.length} recent</small></div>
            {landmarks.length === 0 && <p>Major events will appear here as this world changes.</p>}
            {landmarks.map((landmark) => (
              <button key={`${landmark.id}-${landmark.tick}`} type="button" onClick={() => { setTargetTick(landmark.tick); onSeek(landmark.tick) }}>
                <i />
                <span><strong>{landmark.title}</strong><small>Day {Math.floor(landmark.day)} · tick {landmark.tick.toLocaleString()}</small></span>
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === 'share' && (
        <section className="archive-section share-section">
          <div className="seed-record">
            <small>REPRODUCIBLE SEED</small>
            <strong>{world.seed}</strong>
            <p>A seed link recreates the same terrain and founding population.</p>
            <button type="button" onClick={onCopySeed}>Copy seed link</button>
          </div>
          <div className="portable-actions">
            <div>
              <strong>Portable world record</strong>
              <p>Includes the current ecosystem, action log and replay landmarks.</p>
            </div>
            <button type="button" onClick={() => onExport(name, world)}>Export JSON</button>
            <button type="button" onClick={() => fileRef.current?.click()}>Import JSON</button>
            <input
              ref={fileRef}
              className="visually-hidden"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) onImport(file)
                event.target.value = ''
              }}
            />
          </div>
          <footer>World record v1 · simulation schema v{world.version} · validated before restore</footer>
        </section>
      )}
    </aside>
  )
}
