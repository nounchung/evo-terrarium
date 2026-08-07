import { useEffect, useRef, useState } from 'react'
import { localizeWorldText, useI18n, type Locale } from '../i18n'
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

function dayLabel(day: number, locale: Locale): string {
  const year = Math.max(1, Math.floor(day / 28) + 1)
  const cycleDay = Math.max(1, Math.floor(day % 28) + 1)
  return locale === 'zh-HK' ? `第 ${year} 年，第 ${cycleDay} 日` : `Year ${year}, day ${cycleDay}`
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
  const { locale, isTraditionalChinese, formatDateTime, formatNumber } = useI18n()
  const [tab, setTab] = useState<ArchiveTab>('saves')
  const [name, setName] = useState(`${isTraditionalChinese ? '世界' : 'World'} ${world.seed}`)
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
    <aside className="archive-panel" aria-label={isTraditionalChinese ? '世界檔案館' : 'World archive'}>
      <header>
        <div>
          <small>{isTraditionalChinese ? '版本化世界紀錄' : 'VERSIONED WORLD RECORD'}</small>
          <h2>{isTraditionalChinese ? '世界檔案館' : 'World Archive'}</h2>
          <p>{isTraditionalChinese ? '保存、重訪及分享這段生命歷史' : 'Save, revisit and share this living history'}</p>
        </div>
        <button type="button" onClick={onClose}>{isTraditionalChinese ? '關閉' : 'Close'}</button>
      </header>

      <div className="archive-metrics">
        <div><strong>{slots.length}</strong><span>{isTraditionalChinese ? '個存檔' : 'save slots'}</span></div>
        <div><strong>{world.actionLog.length}</strong><span>{isTraditionalChinese ? '次介入' : 'actions'}</span></div>
        <div><strong>{world.landmarks.length}</strong><span>{isTraditionalChinese ? '個里程碑' : 'landmarks'}</span></div>
      </div>

      <nav className="archive-tabs" aria-label={isTraditionalChinese ? '檔案館分頁' : 'Archive sections'}>
        {(['saves', 'replay', 'share'] as ArchiveTab[]).map((item) => (
          <button key={item} type="button" className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
            {item === 'saves'
              ? (isTraditionalChinese ? '存檔' : 'Save slots')
              : item === 'replay'
                ? (isTraditionalChinese ? '重播' : 'Replay')
                : (isTraditionalChinese ? '分享' : 'Share')}
          </button>
        ))}
      </nav>

      {notice && <p className="archive-notice" role="status">{notice}</p>}

      {tab === 'saves' && (
        <section className="archive-section save-slots">
          <div className="section-heading"><span>{isTraditionalChinese ? '為這一刻命名' : 'NAME THIS MOMENT'}</span><small>{slots.length}/6 {isTraditionalChinese ? '個本機存檔' : 'local slots'}</small></div>
          <div className="save-composer">
            <input aria-label={isTraditionalChinese ? '存檔名稱' : 'Save name'} value={name} maxLength={48} onChange={(event) => setName(event.target.value)} />
            <button type="button" disabled={slots.length >= 6} onClick={() => onSave(name)}>{isTraditionalChinese ? '儲存' : 'Save'}</button>
          </div>
          <div className="slot-list">
            {slots.length === 0 && <p>{isTraditionalChinese ? '尚未有命名存檔。進行重大實驗前，可先保存目前世界。' : 'No named saves yet. Preserve a world before a major experiment.'}</p>}
            {slots.map((slot) => (
              <article key={slot.id}>
                <div>
                  <strong>{slot.name}</strong>
                  <span>{dayLabel(slot.world.day, locale)} · {slot.world.seed}</span>
                  <small>{formatDateTime(slot.savedAt)}</small>
                </div>
                <div>
                  <button type="button" onClick={() => onLoad(slot)}>{isTraditionalChinese ? '還原' : 'Restore'}</button>
                  <button type="button" onClick={() => onExport(slot.name, slot.world)}>{isTraditionalChinese ? '匯出' : 'Export'}</button>
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
                    {confirmDeleteId === slot.id
                      ? (isTraditionalChinese ? '確認刪除' : 'Confirm delete')
                      : (isTraditionalChinese ? '刪除' : 'Delete')}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'replay' && (
        <section className="archive-section replay-section">
          <div className="section-heading"><span>{isTraditionalChinese ? '時間線重建' : 'TIMELINE RECONSTRUCTION'}</span><small>{isTraditionalChinese ? '種子＋介入紀錄' : 'seed + action log'}</small></div>
          <div className="replay-readout">
            <strong>{dayLabel(targetDay, locale)}</strong>
            <span>{isTraditionalChinese ? '時間刻' : 'tick'} {formatNumber(targetTick)} / {formatNumber(maxTick)}</span>
          </div>
          <input
            className="timeline-slider"
            aria-label={isTraditionalChinese ? '重播時間線' : 'Replay timeline'}
            type="range"
            min="0"
            max={maxTick}
            step={Math.max(1, Math.floor(maxTick / 240))}
            value={Math.min(targetTick, maxTick)}
            onChange={(event) => setTargetTick(Number(event.target.value))}
          />
          <div className="replay-actions">
            <button type="button" onClick={() => onSeek(targetTick)}>{isTraditionalChinese ? '重建至此' : 'Rebuild here'}</button>
            {replay.active && <button type="button" onClick={() => onReplaySpeed(5)}>{isTraditionalChinese ? '以 5× 播放' : 'Play 5×'}</button>}
            {replay.active && <button type="button" onClick={() => onReplaySpeed(0)}>{isTraditionalChinese ? '暫停' : 'Pause'}</button>}
            {replay.active && <button className="secondary" type="button" onClick={onReplayExit}>{isTraditionalChinese ? '返回現況' : 'Return live'}</button>}
          </div>
          <div className="landmark-list">
            <div className="section-heading"><span>{isTraditionalChinese ? '生態里程碑' : 'ECOLOGICAL LANDMARKS'}</span><small>{isTraditionalChinese ? `最近 ${landmarks.length} 個` : `${landmarks.length} recent`}</small></div>
            {landmarks.length === 0 && <p>{isTraditionalChinese ? '世界發生變化後，重大事件會在此出現。' : 'Major events will appear here as this world changes.'}</p>}
            {landmarks.map((landmark) => (
              <button key={`${landmark.id}-${landmark.tick}`} type="button" onClick={() => { setTargetTick(landmark.tick); onSeek(landmark.tick) }}>
                <i />
                <span><strong>{localizeWorldText(landmark.title, locale)}</strong><small>{isTraditionalChinese ? '第' : 'Day'} {Math.floor(landmark.day)} {isTraditionalChinese ? `日 · 時間刻 ${formatNumber(landmark.tick)}` : `· tick ${formatNumber(landmark.tick)}`}</small></span>
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === 'share' && (
        <section className="archive-section share-section">
          <div className="seed-record">
            <small>{isTraditionalChinese ? '可重現的種子' : 'REPRODUCIBLE SEED'}</small>
            <strong>{world.seed}</strong>
            <p>{isTraditionalChinese ? '種子連結可重建相同的地形與初始族群。' : 'A seed link recreates the same terrain and founding population.'}</p>
            <button type="button" onClick={onCopySeed}>{isTraditionalChinese ? '複製種子連結' : 'Copy seed link'}</button>
          </div>
          <div className="portable-actions">
            <div>
              <strong>{isTraditionalChinese ? '可攜式世界紀錄' : 'Portable world record'}</strong>
              <p>{isTraditionalChinese ? '包含目前生態系統、介入紀錄及重播里程碑。' : 'Includes the current ecosystem, action log and replay landmarks.'}</p>
            </div>
            <button type="button" onClick={() => onExport(name, world)}>{isTraditionalChinese ? '匯出 JSON' : 'Export JSON'}</button>
            <button type="button" onClick={() => fileRef.current?.click()}>{isTraditionalChinese ? '匯入 JSON' : 'Import JSON'}</button>
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
          <footer>{isTraditionalChinese ? `世界紀錄 v1 · 模擬結構 v${world.version} · 還原前會先驗證` : `World record v1 · simulation schema v${world.version} · validated before restore`}</footer>
        </section>
      )}
    </aside>
  )
}
