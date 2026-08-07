import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type {
  Behaviour,
  CreatureKind,
  DayPhase,
  DeathCause,
  DisasterType,
  EcosystemStatus,
  GeneKey,
  MemoryKind,
  MigrationReason,
  Season,
} from './simulation/types'

export type Locale = 'zh-HK' | 'en'

const LOCALE_KEY = 'evo-terrarium:locale-v1'
const DEFAULT_LOCALE: Locale = 'zh-HK'

function isLocale(value: string | null): value is Locale {
  return value === 'zh-HK' || value === 'en'
}

function initialLocale(): Locale {
  try {
    const query = new URLSearchParams(window.location.search).get('lang')
    if (isLocale(query)) return query
    const stored = window.localStorage.getItem(LOCALE_KEY)
    if (isLocale(stored)) return stored
  } catch {
    // The default remains available when browser storage is blocked.
  }
  return DEFAULT_LOCALE
}

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  isTraditionalChinese: boolean
  formatNumber: (value: number) => string
  formatDateTime: (value: number | Date) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(initialLocale)

  useEffect(() => {
    document.documentElement.lang = locale
    document.title = locale === 'zh-HK'
      ? 'EvoTerrarium — 會自行演化的生命世界'
      : 'EvoTerrarium — A world that learns to live'
    try {
      window.localStorage.setItem(LOCALE_KEY, locale)
    } catch {
      // Language switching still works for the current session.
    }
  }, [locale])

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    isTraditionalChinese: locale === 'zh-HK',
    formatNumber: (number) => number.toLocaleString(locale),
    formatDateTime: (date) => new Date(date).toLocaleString(locale),
  }), [locale])

  return createElement(I18nContext.Provider, { value }, children)
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used within I18nProvider')
  return context
}

const TERMS = {
  kind: {
    grazer: '食草獸',
    hunter: '獵食者',
  } satisfies Record<CreatureKind, string>,
  behaviour: {
    wander: '探索',
    forage: '覓食',
    drink: '尋水',
    flee: '逃走',
    hunt: '狩獵',
    mate: '求偶',
    rest: '休息',
    regroup: '歸隊',
    patrol: '巡邏',
    migrate: '遷徙',
  } satisfies Record<Behaviour, string>,
  deathCause: {
    predation: '被捕食',
    starvation: '飢餓',
    dehydration: '缺水',
    disease: '疾病',
    fire: '山火',
    age: '衰老',
  } satisfies Record<DeathCause, string>,
  disaster: {
    drought: '乾旱',
    flood: '洪水',
    disease: '疾病',
    wildfire: '山火',
  } satisfies Record<DisasterType, string>,
  season: {
    'new-growth': '新生季',
    'high-sun': '盛陽季',
    amberfall: '琥珀落葉季',
    'long-rain': '長雨季',
  } satisfies Record<Season, string>,
  dayPhase: {
    dawn: '黎明',
    day: '日間',
    dusk: '黃昏',
    night: '夜晚',
  } satisfies Record<DayPhase, string>,
  ecosystem: {
    balanced: '平衡',
    stressed: '受壓',
    fragile: '脆弱',
  } satisfies Record<EcosystemStatus, string>,
  gene: {
    speed: '速度',
    vision: '視野',
    size: '體型',
    metabolism: '效率',
    fertility: '繁殖力',
    hue: '顏色',
  } satisfies Record<GeneKey, string>,
  memory: {
    food: '食物',
    water: '水源',
    threat: '威脅',
    shelter: '棲身處',
  } satisfies Record<MemoryKind, string>,
  migration: {
    resources: '資源',
    climate: '氣候',
    threat: '威脅',
  } satisfies Record<MigrationReason, string>,
}

export function localizeKind(value: CreatureKind, locale: Locale): string {
  return locale === 'zh-HK' ? TERMS.kind[value] : value
}

export function localizeBehaviour(value: Behaviour, locale: Locale): string {
  if (locale === 'zh-HK') return TERMS.behaviour[value]
  return value === 'rest' ? 'Resting' : `${value[0].toUpperCase()}${value.slice(1)}`
}

export function localizeDeathCause(value: DeathCause, locale: Locale): string {
  return locale === 'zh-HK' ? TERMS.deathCause[value] : value
}

export function localizeDisaster(value: DisasterType, locale: Locale): string {
  return locale === 'zh-HK' ? TERMS.disaster[value] : `${value[0].toUpperCase()}${value.slice(1)}`
}

export function localizeSeason(value: Season, locale: Locale): string {
  if (locale === 'zh-HK') return TERMS.season[value]
  return {
    'new-growth': 'New Growth',
    'high-sun': 'High Sun',
    amberfall: 'Amberfall',
    'long-rain': 'Long Rain',
  }[value]
}

export function localizeDayPhase(value: DayPhase, locale: Locale): string {
  return locale === 'zh-HK' ? TERMS.dayPhase[value] : value
}

export function localizeEcosystemStatus(value: EcosystemStatus, locale: Locale): string {
  return locale === 'zh-HK' ? TERMS.ecosystem[value] : value
}

export function localizeGene(value: GeneKey, locale: Locale): string {
  return locale === 'zh-HK' ? TERMS.gene[value] : value
}

export function localizeMemory(value: MemoryKind, locale: Locale): string {
  return locale === 'zh-HK' ? TERMS.memory[value] : value
}

export function localizeMigrationReason(value: MigrationReason, locale: Locale): string {
  return locale === 'zh-HK' ? TERMS.migration[value] : value
}

const NAME_PARTS: Record<string, string> = {
  Verdant: '翠綠',
  Ember: '餘燼',
  Golden: '金色',
  Dusky: '暮色',
  Swift: '迅捷',
  Farseeing: '遠望',
  Frugal: '節能',
  Great: '巨型',
  Wild: '野生',
  grazer: '食草獸',
  stalker: '潛獵者',
  leafback: '葉背獸',
  reedrunner: '蘆原奔獸',
  meadowling: '草原靈獸',
  'moss deer': '苔鹿',
  'ash prowler': '灰燼巡獵者',
  emberclaw: '餘燼爪獸',
  redfang: '赤牙獸',
  'dusk stalker': '暮色潛獵者',
}

export function localizeGeneratedName(value: string, locale: Locale): string {
  if (locale !== 'zh-HK') return value
  const herd = value.match(/^Meadow herd (\d+)$/)
  if (herd) return `草原獸群 ${herd[1]}`
  const pack = value.match(/^Ember pack (\d+)$/)
  if (pack) return `餘燼獵群 ${pack[1]}`
  if (value === 'Verdant grazer') return '翠綠食草獸'
  if (value === 'Ember stalker') return '餘燼潛獵者'
  const species = value.match(/^(Golden|Dusky|Swift|Farseeing|Frugal|Great|Wild) (leafback|reedrunner|meadowling|moss deer|ash prowler|emberclaw|redfang|dusk stalker)$/)
  if (!species) return value
  return `${NAME_PARTS[species[1]]}${NAME_PARTS[species[2]]}`
}

function localizeGeneList(value: string): string {
  return value.split(', ').map((gene) => TERMS.gene[gene as GeneKey] ?? gene).join('、')
}

const EXACT_WORLD_COPY: Record<string, string> = {
  'A living world awakens': '一個生命世界甦醒了',
  'A notable mutation appears': '出現顯著突變',
  'A regional drought begins': '區域乾旱開始',
  'Floodwater reshapes a basin': '洪水正在重塑盆地',
  'Disease enters a population': '疾病進入族群',
  'Wildfire crosses the canopy': '山火蔓延過樹冠',
  'Drought recovery begins': '乾旱後的復甦開始',
  'Flood recovery begins': '洪水後的復甦開始',
  'Disease recovery begins': '疾病後的復甦開始',
  'Wildfire recovery begins': '山火後的復甦開始',
  'Rain and soil moisture can now rebuild the depleted plant base.': '雨水與土壤濕度現在能逐步重建受損的植物基礎。',
  'The water has receded, leaving richer meadow patches behind.': '洪水已退去，留下更肥沃的草原地塊。',
  'Transmission has ended; surviving lineages can reproduce again.': '傳播已停止，倖存的譜系可以再次繁殖。',
  'The burn front is out, but cleared forest remains open grassland.': '火線已熄滅，但燒毀的森林仍會維持為開闊草地。',
  'The first successful hunt': '首次成功捕獵',
  'Scarcity claims its first life': '資源短缺奪去首個生命',
  'Water shapes survival': '水源決定生存',
  'Disease changes the population': '疾病改變了族群',
  'Wildfire claims a life': '山火奪去一個生命',
  'A natural lifetime ends': '一段自然壽命終結',
  'Verdant grazers have vanished': '翠綠食草獸已經消失',
  'The food web has lost its primary herbivore.': '食物網已失去主要草食動物。',
  'Ember stalkers have vanished': '餘燼潛獵者已經消失',
  'No predators remain in this world.': '這個世界已沒有任何獵食者。',
  'A grazer was introduced': '加入了一隻食草獸',
  'A hunter was introduced': '加入了一隻獵食者',
  'The food web must adapt to a new arrival.': '食物網必須適應這位新成員。',
}

export function localizeWorldText(value: string, locale: Locale): string {
  if (locale !== 'zh-HK' || !value) return value
  if (EXACT_WORLD_COPY[value]) return EXACT_WORLD_COPY[value]

  let match = value.match(/^Seed (.+) has begun its first day\.$/)
  if (match) return `種子 ${match[1]} 已展開第一天。`
  match = value.match(/^Generation (\d+) has arrived$/)
  if (match) return `第 ${match[1]} 代已誕生`
  match = value.match(/^(.+) has emerged$/)
  if (match) return `${localizeGeneratedName(match[1], locale)}已經出現`
  match = value.match(/^Genetic distance around #(\d+) formed a distinct (grazer|hunter) lineage\.$/)
  if (match) return `#${match[1]} 周圍的基因距離形成了一條獨特的${TERMS.kind[match[2] as CreatureKind]}譜系。`
  match = value.match(/^(.+) #(\d+) differs strongly in (.+)\.$/)
  if (match) return `${localizeGeneratedName(match[1], locale)} #${match[2]} 在${localizeGeneList(match[3])}方面有明顯差異。`
  match = value.match(/^(.+) #(\d+) carries a new combination of inherited traits\.$/)
  if (match) return `${localizeGeneratedName(match[1], locale)} #${match[2]} 帶有新的遺傳特徵組合。`
  match = value.match(/^(Introduced by the world keeper\.|The seeded climate produced this event\.) (\d+) habitat cells are exposed\.$/)
  if (match) {
    const origin = match[1].startsWith('Introduced') ? '由世界管理者引入。' : '由種子決定的氣候觸發。'
    return `${origin}${match[2]} 個棲息地格受到影響。`
  }
  match = value.match(/^(.+) has formed$/)
  if (match) return `${localizeGeneratedName(match[1], locale)}已經形成`
  match = value.match(/^(\d+) grazers now use local herd cohesion\.$/)
  if (match) return `${match[1]} 隻食草獸現在會運用局部獸群凝聚規則。`
  match = value.match(/^(\d+) hunters now share a territorial pack\.$/)
  if (match) return `${match[1]} 隻獵食者現在會共同組成有領域的獵群。`
  match = value.match(/^(.+) completed a migration$/)
  if (match) return `${localizeGeneratedName(match[1], locale)}完成了遷徙`
  match = value.match(/^The (resources|climate|threat)-driven route ended after ([\d.]+) days\.$/)
  if (match) return `由${TERMS.migration[match[1] as MigrationReason]}驅動的路線在 ${match[2]} 天後完成。`
  match = value.match(/^(.+) begins migrating$/)
  if (match) return `${localizeGeneratedName(match[1], locale)}開始遷徙`
  match = value.match(/^(Resources|Climate|Threat) pressure produced a route toward a stronger habitat score\.$/)
  if (match) return `${TERMS.migration[match[1].toLowerCase() as MigrationReason]}壓力促使獸群前往棲息條件評分更高的區域。`
  match = value.match(/^(.+) #(\d+) became part of the food chain\.$/)
  if (match) return `${localizeGeneratedName(match[1], locale)} #${match[2]} 成為食物鏈的一部分。`
  match = value.match(/^(.+) #(\d+) could not find enough food\.$/)
  if (match) return `${localizeGeneratedName(match[1], locale)} #${match[2]} 無法找到足夠食物。`
  match = value.match(/^(.+) #(\d+) died before reaching a shoreline\.$/)
  if (match) return `${localizeGeneratedName(match[1], locale)} #${match[2]} 在抵達岸邊前因缺水死亡。`
  match = value.match(/^(.+) #(\d+) did not survive a regional outbreak\.$/)
  if (match) return `${localizeGeneratedName(match[1], locale)} #${match[2]} 未能熬過區域疫症。`
  match = value.match(/^(.+) #(\d+) was caught inside the burn front\.$/)
  if (match) return `${localizeGeneratedName(match[1], locale)} #${match[2]} 被困在火線之中。`
  match = value.match(/^(.+) #(\d+) reached age ([\d.]+)\.$/)
  if (match) return `${localizeGeneratedName(match[1], locale)} #${match[2]} 活到 ${match[3]} 天。`
  match = value.match(/^(.+) has gone extinct$/)
  if (match) return `${localizeGeneratedName(match[1], locale)}已經滅絕`
  match = value.match(/^Its lineage ended after peaking at (\d+) living organisms\.$/)
  if (match) return `該譜系在最高達到 ${match[1]} 個活體後終結。`
  return localizeGeneratedName(value, locale)
}
