import type { LineageRecord } from '../simulation/types'

interface LineagePanelProps {
  subject: LineageRecord
  genealogy: LineageRecord[]
  livingIds: Set<number>
  onClose: () => void
  onSelectLiving: (id: number) => void
}

const GENE_LABELS: Record<string, string> = {
  speed: 'speed',
  vision: 'vision',
  size: 'body size',
  metabolism: 'efficiency',
  fertility: 'fertility',
  hue: 'colour',
}

function LifeNode({
  record,
  livingIds,
  onSelectLiving,
}: {
  record: LineageRecord | null
  livingIds: Set<number>
  onSelectLiving: (id: number) => void
}) {
  if (!record) return <div className="lineage-node unknown"><small>UNKNOWN</small><strong>History unavailable</strong></div>
  const living = livingIds.has(record.id)
  return (
    <button
      className={`lineage-node ${living ? 'living' : 'past'}`}
      type="button"
      onClick={() => living && onSelectLiving(record.id)}
      disabled={!living}
    >
      <small>G{record.generation} · #{record.id}</small>
      <strong>{record.species}</strong>
      <span>{living ? 'Living now' : record.deathCause ? `Died by ${record.deathCause}` : 'Past life'}</span>
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
    <aside className="lineage-panel glass" aria-label={`Genealogy of ${subject.species} #${subject.id}`}>
      <header>
        <div><small>WORLD PAUSED · GENEALOGY · G{subject.generation}</small><h2>{subject.species} #{subject.id}</h2><p>Trace inherited traits through this life and its family.</p></div>
        <button type="button" onClick={onClose} aria-label="Close genealogy">Close</button>
      </header>

      <section className="lineage-section" aria-labelledby="ancestor-heading">
        <div className="lineage-heading"><h3 id="ancestor-heading">Family line</h3><span>{subject.parents ? 'Two-parent inheritance' : 'Founding life'}</span></div>
        {grandparents.length > 0 && <div className="lineage-row grandparents">{grandparents.map((record, index) => <LifeNode key={record?.id ?? `unknown-${index}`} record={record} livingIds={livingIds} onSelectLiving={onSelectLiving}/>)}</div>}
        {parents.length > 0 && <div className="lineage-row parents">{parents.map((record, index) => <LifeNode key={record?.id ?? `parent-${index}`} record={record} livingIds={livingIds} onSelectLiving={onSelectLiving}/>)}</div>}
        <div className="lineage-row subject"><LifeNode record={subject} livingIds={livingIds} onSelectLiving={onSelectLiving}/></div>
      </section>

      <section className="lineage-section mutation-history" aria-labelledby="mutation-heading">
        <div className="lineage-heading"><h3 id="mutation-heading">Inherited change</h3><span>{subject.mutations.length} mutation{subject.mutations.length === 1 ? '' : 's'}</span></div>
        {subject.mutations.length > 0 ? (
          <div className="mutation-list">
            {subject.mutations.map((mutation) => (
              <article key={mutation.gene} className={mutation.significant ? 'significant' : ''}>
                <small>{mutation.significant ? 'NOTABLE MUTATION' : 'SMALL MUTATION'}</small>
                <strong>{GENE_LABELS[mutation.gene] ?? mutation.gene}</strong>
                <span>{mutation.changePercent.toFixed(1)}% from the inherited value</span>
              </article>
            ))}
          </div>
        ) : <p className="lineage-empty">This life inherited a new combination, but no gene changed during birth.</p>}
        {significant.length > 0 && <p className="mutation-note">Notable changes are visible in body colour, scale, ears, legs or markings.</p>}
      </section>

      <section className="lineage-section" aria-labelledby="offspring-heading">
        <div className="lineage-heading"><h3 id="offspring-heading">Offspring</h3><span>{offspring.length} recorded</span></div>
        {offspring.length > 0 ? <div className="offspring-list">{offspring.slice(0, 8).map((record) => <LifeNode key={record.id} record={record} livingIds={livingIds} onSelectLiving={onSelectLiving}/>)}</div> : <p className="lineage-empty">No offspring have been recorded for this life yet.</p>}
      </section>
    </aside>
  )
}
