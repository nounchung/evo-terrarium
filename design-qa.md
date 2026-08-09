# R9.1 Living Diorama Design QA

Source visual truth: `docs/assets/r9-world-mode.jpg`

Implementation: local branch `agent/r9-living-diorama-spike`, default `?terrain=living`

Implementation screenshot: unavailable — Work Mode `sites-preview` mailbox was unavailable and the cloud browser returned `ERR_CONNECTION_REFUSED` for the local preview bridge.

## Comparison setup

- Source image pixels: 1487 × 1058.
- Intended desktop implementation viewport: 1440 × 1024 CSS pixels at device scale factor 1.
- Intended compact implementation: existing iPhone 14 Pro Max Playwright profile.
- State: `MOSS-1738`, World Mode, default fitted camera, onboarding dismissed.
- Density normalization: not performed because no browser-rendered implementation capture was available.

## Findings

- [P1] Browser-rendered visual evidence is unavailable.
  Location: full World Mode composition.
  Evidence: the source concept opens locally, but the Work Mode cloud browser could not reach the running preview because the preview bridge service was unavailable.
  Impact: shoreline shape, forest density, creature legibility, HUD/world balance and implementation image quality cannot be judged from code or build output.
  Fix: restore the Work Mode preview bridge or obtain explicit approval to use the repository's local Playwright fallback, then capture Living and Classic at the same seed and viewport.

- [P1] Desktop and mobile performance evidence is unavailable.
  Location: canvas renderer metrics.
  Evidence: `data-terrain-build-ms` and rolling `data-fps` are implemented, but no browser session could read them.
  Impact: the R9 renderer budget and the 20% classic comparison limit cannot be approved.
  Fix: record at least three stable samples for both renderers in desktop Chromium and the Mobile Safari profile.

## Required fidelity surfaces

- Fonts and typography: unchanged from R8; not visually re-verified.
- Spacing and layout rhythm: deliberately unchanged in R9.1; full-view comparison blocked.
- Colors and visual tokens: Living biome palettes are implemented; visible balance and contrast remain unverified.
- Image quality and asset fidelity: the concept is an intent reference, while the implementation uses deterministic PixiJS geometry; the visible quality gap cannot be classified without a rendered capture.
- Copy and content: unchanged from R8; not visually re-verified.

## Full-view comparison evidence

Blocked. No same-viewport implementation capture is available.

## Focused region comparison evidence

Blocked. Shoreline, forest/meadow boundary and creature-over-terrain crops cannot be captured.

## Primary interactions and console

- Pan, zoom, pinch, terrain paint and selection: prepared for E2E regression, not browser-verified in this checkpoint.
- Console errors: not inspected because the local preview could not be opened in the Work Mode browser.

## Comparison history

- Iteration 1: implementation completed; automated lint, unit and production build passed.
- Visual comparison did not begin because the required browser-rendered artifact could not be captured.

## Implementation checklist

- Capture same-seed Classic and Living desktop views.
- Capture the Living mobile view and test the existing touch path.
- Inspect shoreline, forest density, creature legibility and HUD/world balance.
- Read terrain build time, rolling FPS and browser console.
- Fix all resulting P0/P1/P2 findings and repeat the same-viewport comparison.

## Follow-up polish

- Consider distance-based decorative density after the first real FPS sample.
- Tune transition-band widths only after seeing the fitted and zoomed world.

final result: blocked
