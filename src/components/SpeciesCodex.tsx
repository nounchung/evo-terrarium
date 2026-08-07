import type { CSSProperties } from 'react'
import { localizeDeathCause, localizeGeneratedName, localizeKind, useI18n, type Locale } from '../i18n'
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

function traitFacts(record: SpeciesRecord, world: WorldState, locale: Locale): string[] {
  const peers = world.creatures.filter((creature) => creature.kind === record.kind)
  const average = (gene: keyof SpeciesRecord['signature']) => peers.length
    ? peers.reduce((total, creature) => total + creature.genes[gene], 0) / peers.length
    : record.signature[gene]
  const speedDelta = average('speed') ? (record.signature.speed / average('speed') - 1) * 100 : 0
  const visionDelta = average('vision') ? (record.signature.vision / average('vision') - 1) * 100 : 0
  const facts = locale === 'zh-HK'
    ? [
        `代表速度比現存${localizeKind(record.kind, locale)}平均值${speedDelta >= 0 ? '高' : '低'} ${Math.abs(speedDelta).toFixed(0)}%。`,
        `代表視野比現存${localizeKind(record.kind, locale)}平均值${visionDelta >= 0 ? '高' : '低'} ${Math.abs(visionDelta).toFixed(0)}%。`,
      ]
    : [
        `Signature speed is ${Math.abs(speedDelta).toFixed(0)}% ${speedDelta >= 0 ? 'above' : 'below'} the living ${record.kind} average.`,
        `Signature vision is ${Math.abs(visionDelta).toFixed(0)}% ${visionDelta >= 0 ? 'above' : 'below'} the living ${record.kind} average.`,
      ]
  const deaths = world.stats.deathsByCause
  const leading = (Object.entries(deaths) as Array<[keyof typeof deaths, number]>)
    .sort((a, b) => b[1] - a[1])[0]
  if (leading && leading[1] > 0) {
    facts.push(locale === 'zh-HK'
      ? `${localizeDeathCause(leading[0], locale)}是目前最主要的死亡壓力（${leading[1]} 個生命）。`
      : `${leading[0][0].toUpperCase()}${leading[0].slice(1)} is the leading recorded death pressure (${leading[1]} lives).`)
  }
  if (world.stats.plants < 60) facts.push(locale === 'zh-HK'
    ? `只剩 ${world.stats.plants} 株成熟植物，食物競爭正在增加。`
    : `Only ${world.stats.plants} mature plants remain, increasing food competition.`)
  else facts.push(locale === 'zh-HK'
    ? `目前有 ${world.stats.plants} 株成熟植物支撐食草獸的食物基礎。`
    : `${world.stats.plants} mature plants currently support the grazer food base.`)
  return facts
}

export function SpeciesCodex({
  world,
  selectedId,
  onSelect,
  onClose,
  onViewFounder,
}: SpeciesCodexProps) {
  const { locale, isTraditionalChinese } = useI18n()
  const selected = world.species.find((record) => record.id === selectedId) ?? world.species[0]
  const parent = world.species.find((record) => record.id === selected.parentSpeciesId)
  const currentTrend = trend(selected)
  const livingSpecies = world.species.filter((record) => record.population > 0).length

  return (
    <aside className="species-codex glass" aria-label={isTraditionalChinese ? '物種圖鑑' : 'Species codex'}>
      <header>
        <div><small>{isTraditionalChinese ? '世界已暫停 · 物種圖鑑' : 'WORLD PAUSED · SPECIES CODEX'}</small><h2>{livingSpecies} {isTraditionalChinese ? '個現存物種' : 'living species'}</h2><p>{isTraditionalChinese ? '當遺傳特徵明顯偏離現有族群時，獨特譜系便會形成。' : 'Distinct lineages emerge when inherited traits move beyond the existing population.'}</p></div>
        <button type="button" onClick={onClose} aria-label={isTraditionalChinese ? '關閉物種圖鑑' : 'Close species codex'}>{isTraditionalChinese ? '關閉' : 'Close'}</button>
      </header>

      <div className="species-layout">
        <nav aria-label={isTraditionalChinese ? '已記錄物種' : 'Recorded species'}>
          {world.species.map((record) => {
            const recordTrend = trend(record)
            const style = { '--species-hue': `${record.signature.hue}deg` } as CSSProperties
            return (
              <button key={record.id} type="button" className={`${selected.id === record.id ? 'active' : ''} ${record.extinctDay ? 'extinct' : ''}`} style={style} onClick={() => onSelect(record.id)}>
                <i className={record.kind} aria-hidden="true"/><span><small>{isTraditionalChinese ? localizeKind(record.kind, locale) : record.kind.toUpperCase()} · S{record.id}</small><strong>{localizeGeneratedName(record.name, locale)}</strong><em>{record.population} {isTraditionalChinese ? '現存' : 'living'} · {recordTrend.delta >= 0 ? '+' : ''}{recordTrend.delta}</em></span>
              </button>
            )
          })}
        </nav>

        <section className="species-profile" aria-label={isTraditionalChinese ? `${localizeGeneratedName(selected.name, locale)}的物種資料` : `Species profile for ${selected.name}`}>
          <div className="species-hero">
            <span className={`species-emblem ${selected.kind}`} style={{ '--species-hue': `${selected.signature.hue}deg` } as CSSProperties}/>
            <div><small>{isTraditionalChinese ? localizeKind(selected.kind, locale) : selected.kind.toUpperCase()} · {isTraditionalChinese ? '物種' : 'SPECIES'} {selected.id}</small><h3>{localizeGeneratedName(selected.name, locale)}</h3><p>{selected.extinctDay ? (isTraditionalChinese ? `於第 ${Math.floor(selected.extinctDay)} 日滅絕` : `Extinct on day ${Math.floor(selected.extinctDay)}`) : (isTraditionalChinese ? `自第 ${Math.floor(selected.emergedDay)} 日起存續` : `Living since day ${Math.floor(selected.emergedDay)}`)}</p></div>
          </div>

          <div className="species-metrics">
            <div><small>{isTraditionalChinese ? '族群' : 'POPULATION'}</small><strong>{selected.population}</strong><span>{currentTrend.delta >= 0 ? '+' : ''}{currentTrend.delta} {isTraditionalChinese ? `／${currentTrend.days || 1} 日` : `over ${currentTrend.days || 1}d`}</span></div>
            <div><small>{isTraditionalChinese ? '高峰' : 'PEAK'}</small><strong>{selected.peakPopulation}</strong><span>{isTraditionalChinese ? '同時存活' : 'living at once'}</span></div>
            <div><small>{isTraditionalChinese ? '起源' : 'ORIGIN'}</small><strong>{isTraditionalChinese ? `第 ${Math.floor(selected.emergedDay)} 日` : `Day ${Math.floor(selected.emergedDay)}`}</strong><span>{parent ? (isTraditionalChinese ? `源自${localizeGeneratedName(parent.name, locale)}` : `from ${parent.name}`) : (isTraditionalChinese ? '創始物種' : 'founding species')}</span></div>
          </div>

          <section className="species-facts">
            <div className="lineage-heading"><h3>{isTraditionalChinese ? '自然選擇證據' : 'Selection evidence'}</h3><span>{isTraditionalChinese ? '來自本世界的事實' : 'facts from this world'}</span></div>
            <ul>{traitFacts(selected, world, locale).map((fact) => <li key={fact}>{fact}</li>)}</ul>
          </section>

          <section className="species-signature">
            <div className="lineage-heading"><h3>{isTraditionalChinese ? '基因特徵' : 'Genetic signature'}</h3><span>{isTraditionalChinese ? '創始數值' : 'founding values'}</span></div>
            <div>
              <span>{isTraditionalChinese ? '速度' : 'Speed'} <strong>{selected.signature.speed.toFixed(0)}</strong></span>
              <span>{isTraditionalChinese ? '視野' : 'Vision'} <strong>{selected.signature.vision.toFixed(0)}</strong></span>
              <span>{isTraditionalChinese ? '體型' : 'Size'} <strong>{selected.signature.size.toFixed(2)}</strong></span>
              <span>{isTraditionalChinese ? '效率' : 'Efficiency'} <strong>{(2 - selected.signature.metabolism).toFixed(2)}</strong></span>
            </div>
          </section>

          {selected.founderId && world.creatures.some((creature) => creature.id === selected.founderId) && (
            <button className="founder-action" type="button" onClick={() => onViewFounder(selected.founderId!)}>{isTraditionalChinese ? `查看現存創始個體 #${selected.founderId}` : `Inspect living founder #${selected.founderId}`}</button>
          )}
        </section>
      </div>
    </aside>
  )
}
