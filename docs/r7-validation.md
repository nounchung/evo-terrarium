# R7 Validation

Status: implementation complete; automated and Jason-mode cross-device gate required before production

## Scope

- Opt-in procedural Web Audio soundscape with water, wind, life, night and tension layers.
- Distinct short audio responses for births, deaths, mutations, speciation, disasters, recovery and migration.
- Three-step, keyboard-contained first-run tour with explicit sound and silent choices.
- Seasonal colour, dawn/dusk light, night fireflies and behaviour-aware creature movement.
- Reduced-motion support and adaptive canvas pixel density for high-DPI mobile devices.
- Screen-reader world summary, event announcements and complete audio control labels.

## Acceptance evidence

- Vitest proves the pure soundscape profile stays bounded and reacts to active disasters.
- Playwright covers first-run onboarding, silent completion and audio enable/disable semantics.
- Existing desktop Chromium and Mobile Safari journeys remain green across all prior releases.
- Production build and lint pass from a clean checkout.
- Jason-mode review checks hierarchy, legibility, first-run pacing, mobile control density, reduced-motion behaviour and audio control clarity.

## Jason-mode design gate

The R7 preview was reviewed at the full desktop composition and against the compact/mobile rules before release. Three issues were corrected before advancing:

- The first-run card now has a safe viewport height and internal overflow, preventing clipped actions in short landscape layouts.
- Background ecological event announcements are silenced while the modal tour is active, keeping the screen-reader reading order focused.
- Web Audio startup failures now resolve to a visible unavailable state instead of leaving an unhandled promise or a falsely active control.

The corrected gate retains the existing visual hierarchy, keeps four essential top actions on compact screens by removing only fullscreen, and exposes the soundscape as an explicit labelled toggle.

## Safety and performance boundaries

- Audio is off by default and starts only after a direct user gesture.
- The soundscape uses synthesized oscillators and filtered noise; it needs no downloaded media or paid service.
- The audio graph is closed when disabled or when the app unmounts.
- Canvas resolution is capped at 1.35× on compact phones, 1.5× on larger mobile layouts and 2× elsewhere.
- Reduced-motion preferences disable creature bobbing and firefly pulsing while preserving ecosystem state.
