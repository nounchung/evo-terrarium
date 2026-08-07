import { localizeDeathCause, localizeGene, localizeGeneratedName, useI18n, type Locale } from '../i18n'
import type { LineageRecord } from '../simulation/types'

interface LineagePanelProps {
  subject: LineageRecord
  genealogy: LineageRecord[]
  livingIds: Set<number>
  onClose: () => void
  onSelectLiving: (id: number) => void
}

function LifeNode({
  record,
  livingIds,
  onSelectLiving,
  locale,
}: {
  record: LineageRecord | null
  livingIds: Set<number>
  onSelectLiving: (id: number) => void
  locale: Locale
}) {
  const zh = locale === 'zh-HK'
  if (!record) return <div className="lineage-node unknown"><small>{zh ? '未知' : 'UNKNOWN'}</small><strong>{zh ? '沒有歷史紀錄' : 'History unavailable'}</strong></div>
  const living = livingIds.has(record.id)
  return (
    <button
      className={`lineage-node ${living ? 'living' : 'past'}`}
      type="button"
      onClick={() => living && onSelectLiving(record.id)}
      disabled={!living}
    >
      <small>G{record.generation} · #{record.id}</small>
      <strong>{localizeGeneratedName(record.species, locale)}</strong>
      <span>{living
        ? (zh ? '目前存活' : 'Living now')
        : record.deathCause
          ? (zh ? `死於${localizeDeathCause(record.deathCause, locale)}` : `Died by ${record.deathCause}`)
          : (zh ? '過往生命' : 'Past life')}</span>
    </button>
  )
}

export function LineagePanel({
  subject,
  genealogy,
  livingIds,
  onClose,
  onSelectLiving,
}: LineagePanelProps) {
  const { locale, isTraditionalChinese } = useI18n()
  const byId = new Map(genealogy.map((record) => [record.id, record]))
  const parents = subject.parents?.map((id) => byId.get(id) ?? null) ?? []
  const grandparents = parents.flatMap((parent) =>
    parent?.parents?.map((id) => byId.get(id) ?? null) ?? [],
  )
  const offspring = subject.children
    .map((id) => byId.get(id))
    .filter((record): record is LineageRecord => Boolean(record))
  const significant = subject.mutations.filter((mutation) => mutation.significant)

  return (
    <aside className="lineage-panel glass" aria-label={isTraditionalChinese ? `${localizeGeneratedName(subject.species, locale)} #${subject.id} 的族譜` : `Genealogy of ${subject.species} #${subject.id}`}>
      <header>
        <div><small>{isTraditionalChinese ? '世界已暫停 · 族譜' : 'WORLD PAUSED · GENEALOGY'} · G{subject.generation}</small><h2>{localizeGeneratedName(subject.species, locale)} #{subject.id}</h2><p>{isTraditionalChinese ? '追溯這個生命及其家族的遺傳特徵。' : 'Trace inherited traits through this life and its family.'}</p></div>
        <button type="button" onClick={onClose} aria-label={isTraditionalChinese ? '關閉族譜' : 'Close genealogy'}>{isTraditionalChinese ? '關閉' : 'Close'}</button>
      </header>

      <section className="lineage-section" aria-labelledby="ancestor-heading">
        <div className="lineage-heading"><h3 id="ancestor-heading">{isTraditionalChinese ? '家族譜系' : 'Family line'}</h3><span>{subject.parents ? (isTraditionalChinese ? '雙親遺傳' : 'Two-parent inheritance') : (isTraditionalChinese ? '創始生命' : 'Founding life')}</span></div>
        {grandparents.length > 0 && <div className="lineage-row grandparents">{grandparents.map((record, index) => <LifeNode key={record?.id ?? `unknown-${index}`} record={record} livingIds={livingIds} onSelectLiving={onSelectLiving} locale={locale}/>)}</div>}
        {parents.length > 0 && <div className="lineage-row parents">{parents.map((record, index) => <LifeNode key={record?.id ?? `parent-${index}`} record={record} livingIds={livingIds} onSelectLiving={onSelectLiving} locale={locale}/>)}</div>}
        <div className="lineage-row subject"><LifeNode record={subject} livingIds={livingIds} onSelectLiving={onSelectLiving} locale={locale}/></div>
      </section>

      <section className="lineage-section mutation-history" aria-labelledby="mutation-heading">
        <div className="lineage-heading"><h3 id="mutation-heading">{isTraditionalChinese ? '遺傳變化' : 'Inherited change'}</h3><span>{subject.mutations.length} {isTraditionalChinese ? '項突變' : `mutation${subject.mutations.length === 1 ? '' : 's'}`}</span></div>
        {subject.mutations.length > 0 ? (
          <div className="mutation-list">
            {subject.mutations.map((mutation) => (
              <article key={mutation.gene} className={mutation.significant ? 'significant' : ''}>
                <small>{mutation.significant ? (isTraditionalChinese ? '顯著突變' : 'NOTABLE MUTATION') : (isTraditionalChinese ? '輕微突變' : 'SMALL MUTATION')}</small>
                <strong>{isTraditionalChinese ? localizeGene(mutation.gene, locale) : mutation.gene === 'size' ? 'body size' : mutation.gene === 'metabolism' ? 'efficiency' : mutation.gene === 'hue' ? 'colour' : mutation.gene}</strong>
                <span>{isTraditionalChinese ? `與遺傳值相差 ${mutation.changePercent.toFixed(1)}%` : `${mutation.changePercent.toFixed(1)}% from the inherited value`}</span>
              </article>
            ))}
          </div>
        ) : <p className="lineage-empty">{isTraditionalChinese ? '這個生命繼承了新的特徵組合，但出生時沒有任何基因發生突變。' : 'This life inherited a new combination, but no gene changed during birth.'}</p>}
        {significant.length > 0 && <p className="mutation-note">{isTraditionalChinese ? '顯著變化可從體色、大小、耳朵、腿部或斑紋看出。' : 'Notable changes are visible in body colour, scale, ears, legs or markings.'}</p>}
      </section>

      <section className="lineage-section" aria-labelledby="offspring-heading">
        <div className="lineage-heading"><h3 id="offspring-heading">{isTraditionalChinese ? '後代' : 'Offspring'}</h3><span>{isTraditionalChinese ? `已記錄 ${offspring.length} 個` : `${offspring.length} recorded`}</span></div>
        {offspring.length > 0 ? <div className="offspring-list">{offspring.slice(0, 8).map((record) => <LifeNode key={record.id} record={record} livingIds={livingIds} onSelectLiving={onSelectLiving} locale={locale}/>)}</div> : <p className="lineage-empty">{isTraditionalChinese ? '這個生命目前尚未有任何後代紀錄。' : 'No offspring have been recorded for this life yet.'}</p>}
      </section>
    </aside>
  )
}
