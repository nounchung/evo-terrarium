import { Languages, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import './App.css'
import { ProceduralSoundscape } from './audio/soundscape'
import { WorldCanvas } from './components/WorldCanvas'
import { LineagePanel } from './components/LineagePanel'
import { SpeciesCodex } from './components/SpeciesCodex'
import { ClimatePanel } from './components/ClimatePanel'
import { SocialLab } from './components/SocialLab'
import { ArchivePanel } from './components/ArchivePanel'
import { OnboardingTour } from './components/OnboardingTour'
import {
  localizeBehaviour,
  localizeEcosystemStatus,
  localizeGeneratedName,
  localizeKind,
  localizeSeason,
  localizeWorldText,
  useI18n,
  type Locale,
} from './i18n'
import {
  listSaveSlots,
  loadWorld,
  removeSaveSlot,
  saveWorld,
  writeSaveSlot,
  type SaveSlot,
} from './simulation/storage'
import { parseWorldRecord, seedShareUrl, serializeWorldRecord } from './simulation/records'
import type {
  CreationTool,
  DisasterType,
  ReplayStatus,
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

const DISASTER_TOOL_META: Record<DisasterType, { id: DisasterType; label: string; icon: IconName; tone: string }> = {
  drought: { id: 'drought', label: 'Place drought', icon: 'spark', tone: 'drought' },
  flood: { id: 'flood', label: 'Release flood', icon: 'water', tone: 'flood' },
  disease: { id: 'disease', label: 'Start disease', icon: 'spark', tone: 'disease' },
  wildfire: { id: 'wildfire', label: 'Ignite wildfire', icon: 'forest', tone: 'wildfire' },
}

const toolMeta = (tool: CreationTool) => TOOLS.find((item) => item.id === tool)
  ?? DISASTER_TOOL_META[tool as DisasterType]

const TOOL_LABELS_ZH: Record<CreationTool, string> = {
  inspect: '觀察',
  grass: '草原',
  water: '水域',
  forest: '森林',
  plant: '種植植物',
  grazer: '加入食草獸',
  hunter: '加入獵食者',
  drought: '放置乾旱',
  flood: '釋放洪水',
  disease: '引發疾病',
  wildfire: '點燃山火',
}

function toolLabel(tool: CreationTool, locale: Locale): string {
  return locale === 'zh-HK' ? TOOL_LABELS_ZH[tool] : toolMeta(tool)?.label ?? tool
}

const SPEEDS: SimSpeed[] = [0, 1, 5, 20, 100]
const ONBOARDING_KEY = 'evo-terrarium:onboarding-v1'

function needsOnboarding(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) !== 'complete'
  } catch {
    return true
  }
}

function rememberOnboarding(): void {
  try {
    window.localStorage.setItem(ONBOARDING_KEY, 'complete')
  } catch {
    // The tour can still be dismissed when storage is unavailable.
  }
}

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
  regroup: 'Returning toward nearby group members to restore cohesion.',
  patrol: 'Moving back through the pack territory as rival pressure changes.',
  migrate: 'Following a locally chosen route toward stronger habitat conditions.',
}

const BEHAVIOUR_COPY_ZH: typeof BEHAVIOUR_COPY = {
  wander: '正在探索附近棲息地，尋找下一個機會。',
  forage: '能量儲備正在下降，因此正在尋找食物。',
  drink: '水分是目前最迫切的需要，因此正前往岸邊。',
  flee: '正在逃離牠目前能察覺到的獵食者。',
  hunt: '正在追蹤獵物，以補充能量儲備。',
  mate: '正在尋找合適伴侶，延續下一代。',
  rest: '目前沒有迫切需要，因此正在保存能量。',
  regroup: '正在返回附近群體成員身邊，恢復凝聚力。',
  patrol: '隨著競爭壓力變化，正在巡視獵群領域。',
  migrate: '正沿著局部選定的路線，前往棲息條件更佳的區域。',
}

function App() {
  const { locale, setLocale, isTraditionalChinese } = useI18n()
  const [world, setWorld] = useState<WorldState | null>(null)
  const [speed, setSpeed] = useState<SimSpeed>(1)
  const [tool, setTool] = useState<CreationTool>('inspect')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [lineageOpen, setLineageOpen] = useState(false)
  const [speciesOpen, setSpeciesOpen] = useState(false)
  const [climateOpen, setClimateOpen] = useState(false)
  const [labMode, setLabMode] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [saveSlots, setSaveSlots] = useState<SaveSlot[]>([])
  const [archiveNotice, setArchiveNotice] = useState('')
  const [replay, setReplay] = useState<ReplayStatus>({ active: false, currentTick: 0, maxTick: 0 })
  const [selectedSpeciesId, setSelectedSpeciesId] = useState(1)
  const [seedDialog, setSeedDialog] = useState(false)
  const [seedDraft, setSeedDraft] = useState('MOSS-1738')
  const [saved, setSaved] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(false)
  const [soundNotice, setSoundNotice] = useState('')
  const [onboardingOpen, setOnboardingOpen] = useState(needsOnboarding)
  const workerRef = useRef<Worker | null>(null)
  const worldRef = useRef<WorldState | null>(null)
  const soundscapeRef = useRef<ProceduralSoundscape | null>(null)
  const soundNoticeTimeoutRef = useRef<number | null>(null)
  const dialogReturnSpeedRef = useRef<SimSpeed>(1)
  const toolReturnSpeedRef = useRef<SimSpeed>(1)
  const lineageReturnSpeedRef = useRef<SimSpeed>(1)
  const speciesReturnSpeedRef = useRef<SimSpeed>(1)
  const archiveReturnSpeedRef = useRef<SimSpeed>(1)
  const replayRef = useRef(replay)
  const localeRef = useRef(locale)

  worldRef.current = world
  replayRef.current = replay
  localeRef.current = locale
  const selected = useMemo(
    () => world?.creatures.find((creature) => creature.id === selectedId) ?? null,
    [selectedId, world],
  )
  const selectedLineage = useMemo(
    () => world?.genealogy.find((record) => record.id === selectedId) ?? null,
    [selectedId, world],
  )
  const livingIds = useMemo(
    () => new Set(world?.creatures.map((creature) => creature.id) ?? []),
    [world],
  )

  useEffect(() => {
    const worker = new Worker(new URL('./simulation/simulation.worker.ts', import.meta.url), {
      type: 'module',
    })
    workerRef.current = worker
    worker.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
      setWorld(event.data.world)
      setCanUndo(event.data.canUndo)
      setSpeed(event.data.speed)
      setReplay(event.data.replay)
      if (replayRef.current.active && !event.data.replay.active) {
        setArchiveNotice(localeRef.current === 'zh-HK' ? '已返回目前世界。' : 'Returned to the live world.')
      } else if (event.data.replay.active) {
        setArchiveNotice(localeRef.current === 'zh-HK'
          ? `已重建至時間刻 ${event.data.replay.currentTick.toLocaleString(localeRef.current)}。`
          : `Replay rebuilt at tick ${event.data.replay.currentTick.toLocaleString(localeRef.current)}.`)
      }
    })
    void loadWorld().then((restored) => {
      const sharedSeed = new URLSearchParams(window.location.search).get('seed')?.trim().slice(0, 80)
      const command: WorkerCommand = {
        type: 'init',
        seed: sharedSeed || restored?.seed || 'MOSS-1738',
        restored: sharedSeed ? undefined : restored,
      }
      setSeedDraft(command.seed)
      worker.postMessage(command)
    })
    void listSaveSlots().then(setSaveSlots)
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (world && soundEnabled) soundscapeRef.current?.update(world)
  }, [soundEnabled, world])

  useEffect(() => () => {
    if (soundNoticeTimeoutRef.current !== null) window.clearTimeout(soundNoticeTimeoutRef.current)
    void soundscapeRef.current?.stop()
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const current = worldRef.current
      if (!current || replayRef.current.active) return
      void saveWorld(current).then(() => {
        setSaved(true)
        window.setTimeout(() => setSaved(false), 1800)
      })
    }, 8000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (selectedId && world && !lineageOpen && !speciesOpen && !world.creatures.some((creature) => creature.id === selectedId)) {
      setSelectedId(null)
    }
  }, [lineageOpen, selectedId, speciesOpen, world])

  const send = (command: WorkerCommand) => workerRef.current?.postMessage(command)
  const showSoundNotice = useCallback((message: string) => {
    setSoundNotice(message)
    if (soundNoticeTimeoutRef.current !== null) window.clearTimeout(soundNoticeTimeoutRef.current)
    soundNoticeTimeoutRef.current = window.setTimeout(() => setSoundNotice(''), 2600)
  }, [])
  const startSound = useCallback(async () => {
    const current = worldRef.current
    if (!current) return
    const soundscape = soundscapeRef.current ?? new ProceduralSoundscape()
    soundscapeRef.current = soundscape
    try {
      const started = await soundscape.start(current)
      setSoundEnabled(started)
      showSoundNotice(started
        ? (isTraditionalChinese ? '生命音景已開啟' : 'Living soundscape on')
        : (isTraditionalChinese ? '此瀏覽器無法使用音訊' : 'Audio is unavailable in this browser'))
    } catch {
      setSoundEnabled(false)
      soundscapeRef.current = null
      void soundscape.stop()
      showSoundNotice(isTraditionalChinese ? '此瀏覽器無法使用音訊' : 'Audio is unavailable in this browser')
    }
  }, [isTraditionalChinese, showSoundNotice])
  const stopSound = useCallback(() => {
    setSoundEnabled(false)
    showSoundNotice(isTraditionalChinese ? '生命音景已關閉' : 'Living soundscape off')
    void soundscapeRef.current?.stop()
    soundscapeRef.current = null
  }, [isTraditionalChinese, showSoundNotice])
  const toggleSound = () => {
    if (soundEnabled) stopSound()
    else void startSound()
  }
  const skipOnboarding = useCallback(() => {
    rememberOnboarding()
    setOnboardingOpen(false)
  }, [])
  const completeOnboarding = useCallback((enableSound: boolean) => {
    rememberOnboarding()
    setOnboardingOpen(false)
    if (enableSound) void startSound()
  }, [startSound])
  const changeSpeed = (nextSpeed: SimSpeed) => {
    setSpeed(nextSpeed)
    send({ type: 'speed', speed: nextSpeed })
  }
  const leaveArchive = () => {
    if (!archiveOpen) return
    if (replay.active) send({ type: 'replay-exit' })
    setArchiveOpen(false)
    setArchiveNotice('')
  }
  const openArchive = () => {
    if (archiveOpen) return
    archiveReturnSpeedRef.current = speciesOpen
      ? speciesReturnSpeedRef.current
      : lineageOpen
        ? lineageReturnSpeedRef.current
        : tool === 'inspect' ? speed : toolReturnSpeedRef.current
    setLineageOpen(false)
    setSpeciesOpen(false)
    setClimateOpen(false)
    setLabMode(false)
    setSelectedId(null)
    setTool('inspect')
    setArchiveNotice('')
    setArchiveOpen(true)
    changeSpeed(0)
    void listSaveSlots().then(setSaveSlots)
  }
  const closeArchive = () => {
    if (replay.active) send({ type: 'replay-exit' })
    setArchiveOpen(false)
    setArchiveNotice('')
    changeSpeed(archiveReturnSpeedRef.current)
  }
  const saveNamedWorld = (name: string) => {
    const current = worldRef.current
    if (!current || replay.active) return
    void writeSaveSlot(name, current).then((slot) => {
      setSaveSlots((existing) => [slot, ...existing].slice(0, 6))
      setArchiveNotice(isTraditionalChinese ? `已儲存「${slot.name}」。` : `Saved “${slot.name}”.`)
    }).catch(() => setArchiveNotice(isTraditionalChinese ? '此瀏覽器無法儲存世界。' : 'This browser could not save the world.'))
  }
  const restoreSlot = (slot: SaveSlot) => {
    setSeedDraft(slot.world.seed)
    setArchiveNotice(isTraditionalChinese ? `已還原「${slot.name}」。` : `Restored “${slot.name}”.`)
    send({ type: 'restore', world: slot.world })
  }
  const deleteSlot = (slot: SaveSlot) => {
    void removeSaveSlot(slot.id).then(() => {
      setSaveSlots((existing) => existing.filter((candidate) => candidate.id !== slot.id))
      setArchiveNotice(isTraditionalChinese ? `已刪除「${slot.name}」。` : `Deleted “${slot.name}”.`)
    }).catch(() => setArchiveNotice(isTraditionalChinese ? '無法刪除此存檔。' : 'This save could not be deleted.'))
  }
  const exportWorld = (name: string, recordWorld: WorldState) => {
    const blob = new Blob([serializeWorldRecord(name, recordWorld)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${recordWorld.seed.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'world'}.evo.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setArchiveNotice(isTraditionalChinese ? '已匯出可攜式世界紀錄。' : 'Portable world record exported.')
  }
  const importWorld = (file: File) => {
    void file.text().then((text) => {
      const record = parseWorldRecord(text)
      setSeedDraft(record.world.seed)
      send({ type: 'restore', world: record.world })
      setArchiveNotice(isTraditionalChinese ? `已匯入「${record.name}」。` : `Imported “${record.name}”.`)
    }).catch((error: unknown) => {
      setArchiveNotice(isTraditionalChinese
        ? '無法讀取此世界紀錄，請確認檔案格式正確。'
        : error instanceof Error ? error.message : 'This world record could not be read.')
    })
  }
  const copySeedLink = () => {
    if (!worldRef.current) return
    const url = seedShareUrl(worldRef.current.seed, window.location.href)
    void navigator.clipboard.writeText(url)
      .then(() => setArchiveNotice(isTraditionalChinese ? '已複製種子連結。' : 'Seed link copied.'))
      .catch(() => setArchiveNotice(url))
  }
  const createWorld = () => {
    const nextSeed = seedDraft.trim().toUpperCase() || makeSeed()
    setSeedDraft(nextSeed)
    setSelectedId(null)
    setLineageOpen(false)
    setSpeciesOpen(false)
    setClimateOpen(false)
    setLabMode(false)
    setArchiveOpen(false)
    setTool('inspect')
    setSeedDialog(false)
    send({ type: 'reset', seed: nextSeed })
    changeSpeed(dialogReturnSpeedRef.current)
  }
  const openSeedDialog = () => {
    if (seedDialog) return
    dialogReturnSpeedRef.current = archiveOpen
      ? archiveReturnSpeedRef.current
      : speciesOpen
      ? speciesReturnSpeedRef.current
      : lineageOpen
        ? lineageReturnSpeedRef.current
        : tool === 'inspect' ? speed : toolReturnSpeedRef.current
    setTool('inspect')
    setLineageOpen(false)
    setSpeciesOpen(false)
    setClimateOpen(false)
    setLabMode(false)
    leaveArchive()
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
  const openLineage = (id: number) => {
    if (!lineageOpen) {
      lineageReturnSpeedRef.current = archiveOpen
        ? archiveReturnSpeedRef.current
        : speciesOpen ? speciesReturnSpeedRef.current : speed
      changeSpeed(0)
    }
    leaveArchive()
    setSpeciesOpen(false)
    setClimateOpen(false)
    setLabMode(false)
    setSelectedId(id)
    setLineageOpen(true)
  }
  const closeLineage = () => {
    setLineageOpen(false)
    if (selectedId !== null && !worldRef.current?.creatures.some((creature) => creature.id === selectedId)) {
      setSelectedId(null)
    }
    changeSpeed(lineageReturnSpeedRef.current)
  }
  const openSpecies = () => {
    speciesReturnSpeedRef.current = archiveOpen
      ? archiveReturnSpeedRef.current
      : lineageOpen
      ? lineageReturnSpeedRef.current
      : tool === 'inspect' ? speed : toolReturnSpeedRef.current
    setLineageOpen(false)
    setClimateOpen(false)
    setLabMode(false)
    leaveArchive()
    setTool('inspect')
    const newestLiving = [...(worldRef.current?.species ?? [])]
      .filter((record) => record.population > 0)
      .sort((a, b) => b.id - a.id)[0]
    setSelectedSpeciesId(newestLiving?.id ?? 1)
    setSpeciesOpen(true)
    changeSpeed(0)
  }
  const closeSpecies = () => {
    setSpeciesOpen(false)
    changeSpeed(speciesReturnSpeedRef.current)
  }
  const chooseTool = (nextTool: CreationTool) => {
    setSelectedId(null)
    const speedBeforeTool = speciesOpen
      ? speciesReturnSpeedRef.current
      : lineageOpen ? lineageReturnSpeedRef.current : archiveOpen ? archiveReturnSpeedRef.current : speed
    setLineageOpen(false)
    setSpeciesOpen(false)
    setClimateOpen(false)
    setLabMode(false)
    leaveArchive()
    if (nextTool === 'inspect') {
      if (tool !== 'inspect') finishCreation()
      return
    }
    if (tool === 'inspect') {
      toolReturnSpeedRef.current = speedBeforeTool
      changeSpeed(0)
    }
    setTool(nextTool)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (seedDialog) closeSeedDialog()
      else if (archiveOpen) {
        if (replay.active) send({ type: 'replay-exit' })
        setArchiveOpen(false)
        setArchiveNotice('')
        changeSpeed(archiveReturnSpeedRef.current)
      }
      else if (climateOpen) setClimateOpen(false)
      else if (labMode) setLabMode(false)
      else if (speciesOpen) {
        setSpeciesOpen(false)
        changeSpeed(speciesReturnSpeedRef.current)
      }
      else if (tool !== 'inspect') finishCreation()
      else if (lineageOpen) {
        setLineageOpen(false)
        if (selectedId !== null && !worldRef.current?.creatures.some((creature) => creature.id === selectedId)) {
          setSelectedId(null)
        }
        changeSpeed(lineageReturnSpeedRef.current)
      }
      else if (selectedId !== null) setSelectedId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [archiveOpen, climateOpen, labMode, lineageOpen, replay.active, seedDialog, selectedId, speciesOpen, tool])
  const openClimate = () => {
    const returnSpeed = archiveOpen
      ? archiveReturnSpeedRef.current
      : speciesOpen
      ? speciesReturnSpeedRef.current
      : lineageOpen
        ? lineageReturnSpeedRef.current
        : tool === 'inspect' ? speed : toolReturnSpeedRef.current
    setLineageOpen(false)
    setSpeciesOpen(false)
    setTool('inspect')
    setClimateOpen(true)
    setLabMode(false)
    leaveArchive()
    changeSpeed(returnSpeed)
  }
  const toggleLabMode = () => {
    if (labMode) {
      setLabMode(false)
      return
    }
    const returnSpeed = archiveOpen
      ? archiveReturnSpeedRef.current
      : speciesOpen
      ? speciesReturnSpeedRef.current
      : lineageOpen
        ? lineageReturnSpeedRef.current
        : tool === 'inspect' ? speed : toolReturnSpeedRef.current
    setLineageOpen(false)
    setSpeciesOpen(false)
    setClimateOpen(false)
    leaveArchive()
    setTool('inspect')
    setLabMode(true)
    changeSpeed(returnSpeed)
  }
  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.()
  }

  const year = world ? Math.max(1, Math.floor(world.day / 28) + 1) : 1
  const day = world ? Math.max(1, Math.floor(world.day % 28) + 1) : 1
  const season = world ? localizeSeason(world.climate.season, locale) : localizeSeason('new-growth', locale)
  const population = (world?.stats.grazers ?? 0) + (world?.stats.hunters ?? 0)
  const foodWebStatus = world?.stats.status ?? 'balanced'
  const foodWebLabel = localizeEcosystemStatus(foodWebStatus, locale)
  const livingSpecies = world?.species.filter((record) => record.population > 0).length ?? 0
  const peers = selected
    ? world?.creatures.filter((creature) => creature.kind === selected.kind) ?? []
    : []
  const averagePeerSpeed = peers.length
    ? peers.reduce((total, creature) => total + creature.genes.speed, 0) / peers.length
    : 0
  const speedDifference = selected && averagePeerSpeed
    ? Math.round((selected.genes.speed / averagePeerSpeed - 1) * 100)
    : 0
  const latestCreature = useMemo(
    () => {
      if (!world || world.creatures.length === 0) return null
      return world.creatures.reduce((latest, creature) =>
        creature.generation > latest.generation || (
          creature.generation === latest.generation && creature.mutations.length > latest.mutations.length
        ) ? creature : latest,
      world.creatures[0])
    },
    [world],
  )
  const browseLatestLineage = () => {
    if (!latestCreature) return
    openLineage(latestCreature.id)
  }

  return (
    <main className={`terrarium ${tool !== 'inspect' ? 'is-creating' : ''}`}>
      <WorldCanvas
        world={world}
        selectedId={selectedId}
        tool={tool}
        labMode={labMode}
        onSelect={setSelectedId}
        onWorldAction={(action, x, y) => send({ type: 'world-action', action, x, y, radius: 58 })}
        onOneShotComplete={finishCreation}
      />

      <header className="topbar">
        <button className="brand glass" type="button" onClick={openSeedDialog} aria-label={isTraditionalChinese ? '建立新世界' : 'Create a new world'}>
          <span className="brand-mark"><Icon name="leaf" size={20} /></span>
          <span><strong>EvoTerrarium</strong><small>{isTraditionalChinese ? '生命世界實驗室' : 'Living world lab'}</small></span>
          <Icon name="chevron" size={14} />
        </button>

        <section className="world-stats glass" aria-label={isTraditionalChinese ? '世界統計' : 'World statistics'}>
          <div><span className="stat-dot grazer"/><strong>{world?.stats.grazers ?? '—'}</strong><small>{isTraditionalChinese ? '食草獸' : 'Grazers'}</small></div>
          <div><span className="stat-dot hunter"/><strong>{world?.stats.hunters ?? '—'}</strong><small>{isTraditionalChinese ? '獵食者' : 'Hunters'}</small></div>
          <div className="desktop-stat"><span className="stat-dot plant"/><strong>{world?.stats.plants ?? '—'}</strong><small>{isTraditionalChinese ? '植物' : 'Plants'}</small></div>
          <button className="lineage-stat" type="button" onClick={browseLatestLineage} disabled={!latestCreature} aria-label={isTraditionalChinese ? '瀏覽最新族譜' : 'Browse latest lineage'}><Icon name="spark" size={15}/><strong>G{world?.stats.maxGeneration ?? 1}</strong><small>{isTraditionalChinese ? '世代' : 'Generation'}</small></button>
          <button className="species-stat" type="button" onClick={openSpecies} disabled={!world} aria-label={isTraditionalChinese ? '開啟物種圖鑑' : 'Open species codex'}><Icon name="leaf" size={15}/><strong>{livingSpecies}</strong><small>{isTraditionalChinese ? '物種' : 'Species'}</small></button>
        </section>

        <div className="top-actions">
          <span className={`save-state ${saved ? 'visible' : ''}`}>{isTraditionalChinese ? '已儲存' : 'Saved'}</span>
          <button
            className="icon-button glass locale-toggle"
            type="button"
            onClick={() => setLocale(isTraditionalChinese ? 'en' : 'zh-HK')}
            aria-label={isTraditionalChinese ? '切換至英文' : '切換至繁體中文'}
            title={isTraditionalChinese ? '切換至英文' : '切換至繁體中文'}
          ><Languages size={16}/><span>{isTraditionalChinese ? 'EN' : '繁'}</span></button>
          <button className={`icon-button glass archive-toggle ${archiveOpen ? 'active' : ''}`} type="button" onClick={openArchive} aria-label={isTraditionalChinese ? '開啟世界檔案館' : 'Open World Archive'}><Icon name="undo" /></button>
          <button className={`icon-button glass lab-toggle ${labMode ? 'active' : ''}`} type="button" onClick={toggleLabMode} aria-label={isTraditionalChinese ? '切換社會實驗室' : 'Toggle Social Lab'}><Icon name="spark" /></button>
          <button
            className={`icon-button glass sound-toggle ${soundEnabled ? 'active' : ''}`}
            type="button"
            onClick={toggleSound}
            aria-label={soundEnabled
              ? (isTraditionalChinese ? '關閉生命音景' : 'Turn living soundscape off')
              : (isTraditionalChinese ? '開啟生命音景' : 'Turn living soundscape on')}
            aria-pressed={soundEnabled}
            title={soundEnabled
              ? (isTraditionalChinese ? '關閉生命音景' : 'Turn living soundscape off')
              : (isTraditionalChinese ? '開啟生命音景' : 'Turn living soundscape on')}
          >
            {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button className="icon-button glass fullscreen-toggle" type="button" onClick={fullscreen} aria-label={isTraditionalChinese ? '切換全螢幕' : 'Toggle fullscreen'}><Icon name="expand" /></button>
          <button className="new-world glass" type="button" onClick={openSeedDialog}><Icon name="seed"/><span>{isTraditionalChinese ? '新世界' : 'New world'}</span></button>
        </div>
      </header>

      <aside className="creation-palette glass" aria-label={isTraditionalChinese ? '創造工具' : 'Creation tools'}>
        <span className="palette-label">{isTraditionalChinese ? '創造' : 'CREATE'}</span>
        {TOOLS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`${tool === item.id ? 'active' : ''} ${item.tone ?? ''}`}
            onClick={() => chooseTool(item.id)}
            aria-label={toolLabel(item.id, locale)}
            aria-pressed={tool === item.id}
          >
            <Icon name={item.icon} size={19}/><span>{toolLabel(item.id, locale)}</span>
            {index === 0 && <i className="palette-divider"/>}
          </button>
        ))}
      </aside>

      <section className="world-calendar glass">
        <div><small>{isTraditionalChinese ? `第 ${year} 年` : `YEAR ${year}`}</small><strong>{isTraditionalChinese ? `第 ${day} 日` : `Day ${day}`}</strong></div>
        <i/>
        <div><small>{isTraditionalChinese ? '季節' : 'SEASON'}</small><strong>{season}</strong></div>
        <i/>
        <div className={`food-web ${foodWebStatus}`}><small>{isTraditionalChinese ? '食物網' : 'FOOD WEB'}</small><strong>{foodWebLabel}</strong></div>
        <button className={`weather-orb ${world?.climate.dayPhase ?? 'day'}`} type="button" onClick={openClimate} aria-label={isTraditionalChinese ? '開啟氣候實驗室' : 'Open climate lab'}><span>{world ? `${world.climate.temperature.toFixed(0)}°` : '—'}</span></button>
      </section>

      <section id="world-accessibility-summary" className="visually-hidden">
        <h1>{isTraditionalChinese ? '生命生態系統摘要' : 'Living ecosystem summary'}</h1>
        <p>{isTraditionalChinese
          ? `${population} 個生命分布於 ${livingSpecies} 個現存物種。食物網目前${foodWebLabel}，季節為${season}。`
          : `${population} creatures across ${livingSpecies} living species. The food web is ${foodWebLabel}. Current season: ${season}.`}</p>
        <p>{isTraditionalChinese ? '使用創造工具改變棲息地，並使用模擬速度控制暫停或推進時間。' : 'Use the creation tools to alter habitat. Use simulation speed controls to pause or advance time.'}</p>
      </section>
      <p className="visually-hidden" role="status" aria-live={onboardingOpen ? 'off' : 'polite'}>{localizeWorldText(world?.events[0]?.title ?? '', locale)}</p>

      {soundNotice && <div className="sound-notice glass" role="status" aria-live="polite">{soundNotice}</div>}

      {!lineageOpen && !speciesOpen && !climateOpen && !labMode && !archiveOpen && <aside className="event-feed" aria-label={isTraditionalChinese ? '最近世界事件' : 'Recent world events'}>
        {(world?.events ?? []).slice(0, 3).map((event, index) => (
          <article key={event.id} className={`event-card glass ${index > 1 ? 'minor' : ''}`}>
            <span className={`event-symbol ${event.kind}`}><Icon name={event.kind === 'death' ? 'hunter' : event.kind === 'player' ? 'seed' : 'spark'} size={15}/></span>
            <div><small>{isTraditionalChinese ? '第' : 'DAY'} {Math.floor(event.day)} {isTraditionalChinese ? '日' : ''}</small><strong>{localizeWorldText(event.title, locale)}</strong><p>{localizeWorldText(event.detail, locale)}</p></div>
          </article>
        ))}
      </aside>}

      {selected && !lineageOpen && !speciesOpen && !climateOpen && !labMode && !archiveOpen && (
        <aside className="creature-card glass" aria-label={isTraditionalChinese ? '所選生物資料' : 'Selected creature details'}>
          <button className="card-close" type="button" onClick={() => { setSelectedId(null); setLineageOpen(false) }} aria-label={isTraditionalChinese ? '關閉生物資料' : 'Close creature details'}><Icon name="close"/></button>
          <div className={`creature-avatar ${selected.kind}`}><Icon name={selected.kind === 'grazer' ? 'grazer' : 'hunter'} size={35}/><i/></div>
          <div className="creature-title"><small>{isTraditionalChinese ? localizeKind(selected.kind, locale) : selected.kind.toUpperCase()} · #{selected.id}</small><h2>{localizeGeneratedName(selected.species, locale)}</h2><p>{isTraditionalChinese ? `第 ${selected.generation} 代` : `Generation ${selected.generation}`} · {localizeBehaviour(selected.behaviour, locale)}</p></div>
          <div className="creature-insight">
            <strong>{localizeBehaviour(selected.behaviour, locale)}</strong>
            <p>{isTraditionalChinese ? BEHAVIOUR_COPY_ZH[selected.behaviour] : BEHAVIOUR_COPY[selected.behaviour]}</p>
            <small>{Math.abs(speedDifference) < 3
              ? (isTraditionalChinese ? '移動速度接近同物種平均值。' : 'Moves near the species average.')
              : (isTraditionalChinese
                  ? `比現存同類${speedDifference > 0 ? '快' : '慢'} ${Math.abs(speedDifference)}%。`
                  : `${Math.abs(speedDifference)}% ${speedDifference > 0 ? 'faster' : 'slower'} than its living peers.`)}</small>
          </div>
          <div className="vitals">
            <div><span>{isTraditionalChinese ? '能量' : 'ENERGY'}</span><strong>{Math.round(selected.energy)}%</strong><i><b style={{ width: `${selected.energy}%` }}/></i></div>
            <div className="hydration"><span>{isTraditionalChinese ? '水分' : 'WATER'}</span><strong>{Math.round(selected.hydration)}%</strong><i><b style={{ width: `${selected.hydration}%` }}/></i></div>
            <div><span>{isTraditionalChinese ? '健康' : 'HEALTH'}</span><strong>{Math.round(selected.health)}%</strong><i><b style={{ width: `${selected.health}%` }}/></i></div>
            <div><span>{isTraditionalChinese ? '年齡' : 'AGE'}</span><strong>{selected.age.toFixed(1)}{isTraditionalChinese ? '日' : 'd'}</strong><i><b style={{ width: `${Math.min(100, selected.age / selected.maxAge * 100)}%` }}/></i></div>
          </div>
          <div className="life-history" aria-label={isTraditionalChinese ? '生物生命紀錄' : 'Creature life history'}>
            <span><strong>{selected.meals}</strong> {isTraditionalChinese ? '次進食' : 'meals'}</span>
            <span><strong>{selected.drinks}</strong> {isTraditionalChinese ? '次飲水' : 'drinks'}</span>
            {selected.kind === 'hunter' && <span><strong>{selected.kills}</strong> {isTraditionalChinese ? '次狩獵' : 'hunts'}</span>}
          </div>
          <div className="gene-panel">
            <div className="section-heading"><span>{isTraditionalChinese ? '遺傳特徵' : 'INHERITED TRAITS'}</span><small>{selected.parents ? (isTraditionalChinese ? '雙親' : '2 parents') : (isTraditionalChinese ? '創始生命' : 'Founding life')}</small></div>
            <GeneBar label={isTraditionalChinese ? '速度' : 'Speed'} value={selected.genes.speed} min={24} max={78}/>
            <GeneBar label={isTraditionalChinese ? '視野' : 'Vision'} value={selected.genes.vision} min={55} max={240}/>
            <GeneBar label={isTraditionalChinese ? '體型' : 'Size'} value={selected.genes.size * 100} min={58} max={170}/>
            <GeneBar label={isTraditionalChinese ? '效率' : 'Efficiency'} value={(2 - selected.genes.metabolism) * 50} min={10} max={80}/>
            {selected.mutations.length > 0 && <div className="mutation-summary"><strong>{selected.mutations.filter((mutation) => mutation.significant).length}</strong><span>{isTraditionalChinese ? `項顯著 · 共 ${selected.mutations.length} 項突變` : `notable · ${selected.mutations.length} total mutations`}</span></div>}
          </div>
          <footer><span><strong>{selected.children.length}</strong> {isTraditionalChinese ? '個後代' : 'offspring'}</span><button type="button" onClick={() => openLineage(selected.id)}>{isTraditionalChinese ? '開啟族譜' : 'Open genealogy'}</button></footer>
        </aside>
      )}

      {lineageOpen && selectedLineage && world && (
        <LineagePanel
          subject={selectedLineage}
          genealogy={world.genealogy}
          livingIds={livingIds}
          onClose={closeLineage}
          onSelectLiving={(id) => setSelectedId(id)}
        />
      )}

      {speciesOpen && world && (
        <SpeciesCodex
          world={world}
          selectedId={selectedSpeciesId}
          onSelect={setSelectedSpeciesId}
          onClose={closeSpecies}
          onViewFounder={(id) => {
            setSpeciesOpen(false)
            setSelectedId(id)
            changeSpeed(speciesReturnSpeedRef.current)
          }}
        />
      )}

      {climateOpen && world && (
        <ClimatePanel
          world={world}
          onClose={() => setClimateOpen(false)}
          onTrigger={(type) => chooseTool(type)}
        />
      )}

      {labMode && world && (
        <SocialLab
          world={world}
          selected={selected}
          onClose={() => setLabMode(false)}
          onInspectCreature={setSelectedId}
        />
      )}

      {archiveOpen && world && (
        <ArchivePanel
          world={world}
          slots={saveSlots}
          replay={replay}
          notice={archiveNotice}
          onClose={closeArchive}
          onSave={saveNamedWorld}
          onLoad={restoreSlot}
          onDelete={deleteSlot}
          onExport={exportWorld}
          onImport={importWorld}
          onCopySeed={copySeedLink}
          onSeek={(tick) => { setArchiveNotice(isTraditionalChinese ? '正從創始種子重建…' : 'Rebuilding from the founding seed…'); send({ type: 'replay-seek', tick }) }}
          onReplayExit={() => { send({ type: 'replay-exit' }); setArchiveNotice(isTraditionalChinese ? '已返回目前世界。' : 'Returned to the live world.') }}
          onReplaySpeed={changeSpeed}
        />
      )}

      <section className="time-controls glass" aria-label={isTraditionalChinese ? '模擬速度' : 'Simulation speed'}>
        {SPEEDS.map((value) => (
          <button key={value} type="button" disabled={archiveOpen} className={speed === value ? 'active' : ''} onClick={() => changeSpeed(value)} aria-label={value === 0 ? (isTraditionalChinese ? '暫停模擬' : 'Pause simulation') : (isTraditionalChinese ? `以 ${value} 倍速度運行` : `Run at ${value} times speed`)}>
            {value === 0 ? <Icon name={speed === 0 ? 'play' : 'pause'} size={17}/> : `${value}×`}
          </button>
        ))}
        <span className="time-divider"/>
        <div className="population"><small>{replay.active ? (isTraditionalChinese ? '重播' : 'REPLAY') : (isTraditionalChinese ? '生命' : 'LIVING')}</small><strong>{population}</strong></div>
      </section>

      {tool !== 'inspect' && (
        <section className="tool-status glass" role="status" aria-live="polite">
          <span className={`tool-swatch ${tool}`}><Icon name={toolMeta(tool)?.icon ?? 'cursor'} size={16}/></span>
          <div><small>{isTraditionalChinese ? '世界已暫停' : 'WORLD PAUSED'} · {DISASTER_TOOL_META[tool as DisasterType] ? (isTraditionalChinese ? '區域壓力' : 'REGIONAL PRESSURE') : (isTraditionalChinese ? '創造工具' : 'CREATION TOOL')}</small><strong>{toolLabel(tool, locale)}</strong><p>{isTraditionalChinese ? '點按套用 · 拖動探索 · Esc 完成' : 'Tap to apply · Drag to explore · Esc to finish'}</p></div>
          <button type="button" onClick={() => send({ type: 'undo' })} disabled={!canUndo} aria-label={isTraditionalChinese ? '復原上一次世界變更' : 'Undo last world change'}><Icon name="undo" size={16}/><span>{isTraditionalChinese ? '復原' : 'Undo'}</span></button>
          <button type="button" onClick={finishCreation}>{isTraditionalChinese ? '完成' : 'Done'}</button>
        </section>
      )}

      <div className="gesture-hint"><span>{tool === 'inspect'
        ? (isTraditionalChinese ? '拖動探索 · 雙指或滾輪縮放' : 'Drag to explore · Pinch or scroll to zoom')
        : (isTraditionalChinese ? '點按套用 · 拖動仍會移動世界' : 'Tap to apply · Drag still moves the world')}</span></div>

      {!world && <div className="loading"><span className="loading-leaf"><Icon name="leaf" size={28}/></span><strong>{isTraditionalChinese ? '正在孕育你的世界…' : 'Growing your world…'}</strong></div>}

      {seedDialog && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSeedDialog() }}>
          <section className="seed-dialog" role="dialog" aria-modal="true" aria-labelledby="seed-title">
            <button className="card-close" type="button" onClick={closeSeedDialog} aria-label={isTraditionalChinese ? '關閉' : 'Close'}><Icon name="close"/></button>
            <span className="dialog-mark"><Icon name="seed" size={25}/></span>
            <small>{isTraditionalChinese ? '創世實驗室' : 'GENESIS LAB'}</small>
            <h2 id="seed-title">{isTraditionalChinese ? '開始另一個生命世界' : 'Begin another living world'}</h2>
            <p>{isTraditionalChinese ? '相同種子會產生相同的初始地形。之後發生甚麼，取決於生命——也取決於你。' : 'A seed creates the same starting landscape. What happens next depends on life—and on you.'}</p>
            <label htmlFor="world-seed">{isTraditionalChinese ? '世界種子' : 'WORLD SEED'}</label>
            <div className="seed-input"><Icon name="spark" size={17}/><input id="world-seed" value={seedDraft} onChange={(event) => setSeedDraft(event.target.value)} autoFocus/><button type="button" onClick={() => setSeedDraft(makeSeed())}>{isTraditionalChinese ? '隨機產生' : 'Randomise'}</button></div>
            <button className="begin-button" type="button" onClick={createWorld}>{isTraditionalChinese ? '孕育這個世界' : 'Grow this world'} <Icon name="chevron"/></button>
            <small className="dialog-note"><strong>{isTraditionalChinese ? '選擇期間世界已暫停。' : 'World paused while choosing.'}</strong> {isTraditionalChinese ? '目前世界會自動儲存在此裝置。' : 'Your current world is auto-saved on this device.'}</small>
          </section>
        </div>
      )}

      {world && onboardingOpen && (
        <OnboardingTour onComplete={completeOnboarding} onSkip={skipOnboarding} />
      )}
    </main>
  )
}

export default App
