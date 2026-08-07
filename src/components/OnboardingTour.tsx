import { Archive, MousePointer2, Sparkles, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

interface OnboardingTourProps {
  onComplete: (enableSound: boolean) => void
  onSkip: () => void
}

const STEPS: Array<{
  eyebrow: string
  title: string
  body: string
  detail: string
  icon: ReactNode
}> = [
  {
    eyebrow: 'OBSERVE',
    title: 'Meet a world already in motion',
    body: 'Every creature is deciding when to forage, flee, drink, hunt, rest and reproduce.',
    detail: 'Drag to roam, pinch or scroll to zoom, then select a creature to inspect its needs and inherited traits.',
    icon: <MousePointer2 size={26} strokeWidth={1.7} />,
  },
  {
    eyebrow: 'SHAPE',
    title: 'Change habitat, not outcomes',
    body: 'Add water, meadow, forest, plants or new animals with the creation rail.',
    detail: 'The world pauses while a tool is armed, so every intervention is deliberate. Life responds through the same local rules.',
    icon: <Sparkles size={26} strokeWidth={1.7} />,
  },
  {
    eyebrow: 'REMEMBER',
    title: 'Watch generations become history',
    body: 'Speed up time, trace lineages and revisit ecological turning points in the World Archive.',
    detail: 'The optional living soundscape follows water, weather, population and major world events. You stay in control of audio.',
    icon: <Archive size={26} strokeWidth={1.7} />,
  },
]

export function OnboardingTour({ onComplete, onSkip }: OnboardingTourProps) {
  const [step, setStep] = useState(0)
  const dialogRef = useRef<HTMLElement>(null)
  const current = STEPS[step]
  const finalStep = step === STEPS.length - 1

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
          <button type="button" onClick={onSkip}>Skip tour</button>
        </header>
        <small>{current.eyebrow} · {step + 1} OF {STEPS.length}</small>
        <h1 id="onboarding-title">{current.title}</h1>
        <p id="onboarding-copy">{current.body}</p>
        <div className="onboarding-detail">{current.detail}</div>
        <footer>
          <div className="onboarding-progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
            {STEPS.map((item, index) => <i key={item.title} className={index === step ? 'active' : ''} />)}
          </div>
          {!finalStep ? (
            <button className="onboarding-next" type="button" onClick={() => setStep((value) => value + 1)}>
              Next
            </button>
          ) : (
            <div className="onboarding-finish">
              <button type="button" onClick={() => onComplete(false)}>Continue silently</button>
              <button className="onboarding-next" type="button" onClick={() => onComplete(true)}>
                <Volume2 size={16} /> Start with sound
              </button>
            </div>
          )}
        </footer>
      </section>
    </div>
  )
}
