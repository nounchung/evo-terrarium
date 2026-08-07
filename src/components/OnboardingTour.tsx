import { Archive, MousePointer2, Sparkles, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../i18n'

interface OnboardingTourProps {
  onComplete: (enableSound: boolean) => void
  onSkip: () => void
}

const STEPS: Array<{
  eyebrow: string
  title: string
  body: string
  detail: string
  zhEyebrow: string
  zhTitle: string
  zhBody: string
  zhDetail: string
  icon: ReactNode
}> = [
  {
    eyebrow: 'OBSERVE',
    title: 'Meet a world already in motion',
    body: 'Every creature is deciding when to forage, flee, drink, hunt, rest and reproduce.',
    detail: 'Drag to roam, pinch or scroll to zoom, then select a creature to inspect its needs and inherited traits.',
    zhEyebrow: '觀察',
    zhTitle: '走進一個已經運轉的世界',
    zhBody: '每個生命都會自行決定何時覓食、逃走、飲水、狩獵、休息與繁殖。',
    zhDetail: '拖動畫面探索世界，以雙指或滾輪縮放，再選取生物查看牠的需要與遺傳特徵。',
    icon: <MousePointer2 size={26} strokeWidth={1.7} />,
  },
  {
    eyebrow: 'SHAPE',
    title: 'Change habitat, not outcomes',
    body: 'Add water, meadow, forest, plants or new animals with the creation rail.',
    detail: 'The world pauses while a tool is armed, so every intervention is deliberate. Life responds through the same local rules.',
    zhEyebrow: '塑造',
    zhTitle: '改變棲息地，而非預設結果',
    zhBody: '利用創造工具加入水域、草原、森林、植物或新的動物。',
    zhDetail: '工具啟用時世界會暫停，讓每次介入都出於你的選擇；生命仍會依照相同的局部規則作出反應。',
    icon: <Sparkles size={26} strokeWidth={1.7} />,
  },
  {
    eyebrow: 'REMEMBER',
    title: 'Watch generations become history',
    body: 'Speed up time, trace lineages and revisit ecological turning points in the World Archive.',
    detail: 'The optional living soundscape follows water, weather, population and major world events. You stay in control of audio.',
    zhEyebrow: '記錄',
    zhTitle: '看著世代成為歷史',
    zhBody: '加快時間、追溯族譜，並在世界檔案館重訪生態轉捩點。',
    zhDetail: '可選的生命音景會跟隨水流、天氣、族群及重大事件變化；聲音是否啟用始終由你控制。',
    icon: <Archive size={26} strokeWidth={1.7} />,
  },
]

export function OnboardingTour({ onComplete, onSkip }: OnboardingTourProps) {
  const { isTraditionalChinese } = useI18n()
  const [step, setStep] = useState(0)
  const dialogRef = useRef<HTMLElement>(null)
  const current = STEPS[step]
  const finalStep = step === STEPS.length - 1
  const eyebrow = isTraditionalChinese ? current.zhEyebrow : current.eyebrow
  const title = isTraditionalChinese ? current.zhTitle : current.title
  const body = isTraditionalChinese ? current.zhBody : current.body
  const detail = isTraditionalChinese ? current.zhDetail : current.detail

  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSkip()
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled])')]
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onSkip, step])

  return (
    <div className="onboarding-backdrop">
      <section
        className="onboarding-card"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-copy"
        tabIndex={-1}
      >
        <header>
          <span className="onboarding-icon">{current.icon}</span>
          <button type="button" onClick={onSkip}>{isTraditionalChinese ? '略過導覽' : 'Skip tour'}</button>
        </header>
        <small>{eyebrow} · {step + 1} {isTraditionalChinese ? '/': 'OF'} {STEPS.length}</small>
        <h1 id="onboarding-title">{title}</h1>
        <p id="onboarding-copy">{body}</p>
        <div className="onboarding-detail">{detail}</div>
        <footer>
          <div className="onboarding-progress" aria-label={isTraditionalChinese ? `第 ${step + 1} 步，共 ${STEPS.length} 步` : `Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((item, index) => <i key={item.title} className={index === step ? 'active' : ''} />)}
          </div>
          {!finalStep ? (
            <button className="onboarding-next" type="button" onClick={() => setStep((value) => value + 1)}>
              {isTraditionalChinese ? '下一步' : 'Next'}
            </button>
          ) : (
            <div className="onboarding-finish">
              <button type="button" onClick={() => onComplete(false)}>{isTraditionalChinese ? '靜音開始' : 'Continue silently'}</button>
              <button className="onboarding-next" type="button" onClick={() => onComplete(true)}>
                <Volume2 size={16} /> {isTraditionalChinese ? '開啟音景' : 'Start with sound'}
              </button>
            </div>
          )}
        </footer>
      </section>
    </div>
  )
}
