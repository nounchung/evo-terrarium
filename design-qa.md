# R9.2 Species and Behaviour Design QA

Source visual truth: `docs/assets/r9-world-mode.jpg`

Implementation: branch `agent/r9-2-species-behaviour`, `?terrain=living&r9qa=species&seed=MOSS-1738`

Evidence: `docs/assets/r9.2-desktop-iteration2.jpg`, `docs/assets/r9.2-mobile-safari-species.png`, the combined `docs/assets/r9.2-final-comparison.jpg`, GitHub Quality run #48 `r9-evidence` artifact, and the Vercel preview reviewed in the Work Mode cloud browser.

## Comparison setup

- Source image: 1487 × 1058 pixels.
- Desktop implementation: 1363 × 936 CSS pixels and captured pixels at 1× density.
- Compact implementation: Playwright iPhone 14 Pro Max profile at 430 × 740 CSS viewport pixels, 430 × 932 screen profile and 3× device density; captured output is 1290 × 2220 pixels.
- State: `MOSS-1738`, Living terrain, onboarding dismissed, simulation paused for the controlled seven-creature scene.
- Full-view input: the source was proportionally fitted and padded to 1363 × 936, joined beside the desktop implementation, and stacked with the final Mobile Safari capture in `docs/assets/r9.2-final-comparison.jpg` for one visual judgment input.
- Focused region: the seven controlled organisms were compared together at their real fitted-camera positions: four grazers above and three hunters below.

## Findings resolved

- [P2] The first controlled-scene pass made the seven behaviour cues too small to identify reliably at the desktop evidence scale.
  Resolution: the renderer-only QA scene now presents creatures at 1.55× evidence scale. The normal world remains at 1× and simulation state is unchanged.

- [P2] The first Mobile Safari capture placed the top adult beneath the event card and the final older hunter beneath the bottom controls.
  Resolution: the compact scene now uses four compressed rows inside the mobile playfield safe area; the final capture keeps all seven organisms and their cues clear of both overlays.

- [P1] Early WebKit artifacts intermittently bound a neighbouring creature texture, so a grazer could occupy a hunter slot or all six slots could share the final upload.
  Resolution: the six original 256px images are packed without resampling into one 3×2 atlas and rendered through six frame rectangles on one GPU source. Run #48 shows the correct four grazers and three hunters in their intended life stages.

No unresolved P0, P1 or P2 finding remains inside the R9.2 species-and-behaviour scope.

## Full-view comparison

- Grazer and hunter families are immediately distinct: pale, upright moss deer contrast with low, rust-and-charcoal ember stalkers.
- The implementation preserves the concept's world-first hierarchy: organisms sit inside the playfield while HUD, event cards, creation tools and speed controls remain visually secondary and usable.
- The implementation intentionally keeps the existing deterministic R9.1 terrain style. Photoreal foliage, authored elevation and cinematic material depth in the concept are later R9 work and were not re-gated here.
- A normal-world cloud-browser pass reached 95 organisms at 1× scale. Species remained distinguishable at full detail; the separate reduced-detail threshold covers still larger or more distant populations.

## Focused-region comparison

- Life stages: juveniles have smaller bodies and shorter extremities, adults carry the full silhouette, and older organisms use heavier/desaturated forms. All three stages are visible in one controlled scene.
- Species: grazer neck/leg proportions and light moss palette remain distinct from the hunter's low stalking posture, large tail and ember palette.
- Behaviour: forage, hunt, flee, rest, mate, drink and migrate each retain a separate posture or bounded cue. The state cue remains present under reduced motion while decorative bob and trails are removed.
- Genes: authoritative size, hue and shape values tint and proportion the raster sprites; the visual layer does not synthesize alternate simulation state.
- Dense/distant rendering: full detail is used at the controlled fitted scale, while populations above 115 organisms or zoom below 0.58 use reduced detail.

## Interactions, console and performance

- Cloud-browser camera drag completed without blanking or corrupting the canvas; the normal world and controlled scene both remained readable after navigation.
- Wheel synthesis timed out in the remote Chrome protocol, so zoom regression is accepted from the same R9 Playwright suite that already exercises camera/terrain interaction rather than from a second synthetic cloud-browser gesture.
- The latest Vercel preview exposed `data-creature-renderer="raster-sprites"`, `data-creature-texture-source="atlas"`, all three life stages, all seven behaviour cues, desktop layout, QA scale 1.55 and a 0.30 ms controlled-scene creature build.
- The normal world exposed 95 organisms, full detail at fitted scale, a 1.60 ms creature build and a 28.50 ms terrain build in the throttled cloud browser.
- No application-origin console warning or error was found in the final preview.
- GitHub Quality run #48 validates 36/36 E2E journeys, the 100 ms creature-build ceiling, reduced motion and desktop/mobile screenshot states. Absolute cloud/CI FPS is not used as physical-device evidence when the browser is visibly background-throttled.

## Comparison history

- Iteration 1: renderer modules, six stage sprites, gene variation and seven authoritative behaviour cues implemented; first desktop comparison found undersized action evidence.
- Iteration 2: controlled-scene evidence scale increased to 1.55× without changing the normal world; same-input source/implementation comparison confirmed species, life-stage and behaviour readability.
- Iteration 3: the first real Mobile Safari artifact exposed top/bottom overlay collisions; the four compact rows were moved into the mobile safe playfield and protected by a unit assertion.
- Iteration 4: WebKit evidence exposed intermittent multi-source texture binding; one lossless six-frame atlas removed the race and the final same-input comparison confirmed the corrected species mapping.
- Final: normal-world density, corrected compact layout, reduced motion, 36/36 automated journeys, build budget and application console were checked before the Jason Gate.

## Follow-up polish

- R9.3 can add follow-camera and event framing without changing the creature-state mapping proven here.
- Later R9 phases can add richer authored vegetation, elevation and cinematic lighting while retaining the R9.2 sprites and deterministic simulation contract.

final result: passed