import { localizeDayPhase, localizeDisaster, localizeSeason, useI18n } from '../i18n'
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

const DISASTER_EFFECTS_ZH: Record<DisasterType, string> = {
  drought: '消耗土壤、植物及動物水分。',
  flood: '令生命減速，退水後留下更肥沃的草原。',
  disease: '在局部區域造成傷害並暫停繁殖。',
  wildfire: '燒毀植物，令森林變成開闊草地。',
}

export function ClimatePanel({ world, onClose, onTrigger }: ClimatePanelProps) {
  const { locale, isTraditionalChinese } = useI18n()
  const active = world.disasters.filter((record) => world.day < record.endsDay)
  const latestRecovery = [...world.disasters].reverse().find((record) => record.recoveryNoted)
  return (
    <aside className="climate-panel" aria-label={isTraditionalChinese ? '氣候與災害實驗室' : 'Climate and disaster lab'}>
      <header>
        <div><small>{isTraditionalChinese ? '即時環境' : 'LIVE ENVIRONMENT'}</small><h2>{localizeSeason(world.climate.season, locale)}</h2><p>{localizeDayPhase(world.climate.dayPhase, locale)} · {isTraditionalChinese ? '區域壓力實驗室' : 'regional pressure lab'}</p></div>
        <button type="button" onClick={onClose} aria-label={isTraditionalChinese ? '關閉氣候實驗室' : 'Close climate lab'}>{isTraditionalChinese ? '關閉' : 'Close'}</button>
      </header>

      <div className="climate-metrics">
        <div><small>{isTraditionalChinese ? '溫度' : 'TEMPERATURE'}</small><strong>{world.climate.temperature.toFixed(1)}°</strong><span>{world.climate.temperature > 26 ? (isTraditionalChinese ? '熱壓力上升' : 'heat stress rising') : (isTraditionalChinese ? '處於溫和範圍' : 'within mild range')}</span></div>
        <div><small>{isTraditionalChinese ? '降雨' : 'RAINFALL'}</small><strong>{Math.round(world.climate.rainfall * 100)}%</strong><span>{world.climate.rainfall > 0.62 ? (isTraditionalChinese ? '可見降雨' : 'rain is visible') : (isTraditionalChinese ? '間歇降雨' : 'intermittent')}</span></div>
        <div><small>{isTraditionalChinese ? '土壤' : 'SOIL'}</small><strong>{Math.round(world.climate.soilMoisture)}%</strong><span>{world.climate.soilMoisture < 35 ? (isTraditionalChinese ? '植物生長受限' : 'plant growth limited') : (isTraditionalChinese ? '有利重新生長' : 'supports regrowth')}</span></div>
      </div>

      <section className="active-pressure">
        <div className="section-heading"><span>{isTraditionalChinese ? '目前壓力' : 'ACTIVE PRESSURES'}</span><small>{active.length || (isTraditionalChinese ? '沒有' : 'none')}</small></div>
        {active.length > 0 ? active.map((record) => (
          <article key={record.id}>
            <i className={record.type}/><div><strong>{localizeDisaster(record.type, locale)}</strong><span>{isTraditionalChinese ? `尚餘 ${Math.max(0, record.endsDay - world.day).toFixed(1)} 日 · ${record.affectedCells} 格` : `${Math.max(0, record.endsDay - world.day).toFixed(1)} days remain · ${record.affectedCells} cells`}</span></div>
          </article>
        )) : <p>{isTraditionalChinese ? '目前沒有區域災害。由種子決定的氣候仍會持續改變生存成本。' : 'No regional disaster is active. The seeded climate continues to change survival costs.'}</p>}
        {latestRecovery && <small className="recovery-note">{isTraditionalChinese ? `最近復甦：${localizeDisaster(latestRecovery.type, locale)}令 ${latestRecovery.affectedCells} 個棲息地格發生改變或資源耗盡。` : `Latest recovery: ${latestRecovery.type} left ${latestRecovery.affectedCells} habitat cells changed or depleted.`}</small>}
      </section>

      <section className="disaster-actions">
        <div className="section-heading"><span>{isTraditionalChinese ? '引入區域壓力' : 'INTRODUCE A PRESSURE'}</span><small>{isTraditionalChinese ? '點按世界放置' : 'tap the world to place'}</small></div>
        <div>
          {DISASTERS.map((item) => (
            <button key={item.type} type="button" onClick={() => onTrigger(item.type)}>
              <i className={item.type}/><span><strong>{isTraditionalChinese ? localizeDisaster(item.type, locale) : item.label}</strong><small>{isTraditionalChinese ? DISASTER_EFFECTS_ZH[item.type] : item.effect}</small></span>
            </button>
          ))}
        </div>
      </section>
      <footer>{isTraditionalChinese ? '種子驅動的事件會確定地發生；玩家事件採用相同的有限規則，並可以復原。' : 'Seed-driven events arrive deterministically. Player events use the same bounded rules and can be undone.'}</footer>
    </aside>
  )
}
