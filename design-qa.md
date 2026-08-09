# R9.1 Living Diorama Design QA

Source visual truth: `docs/assets/r9-world-mode.jpg`

Implementation: branch `agent/r9-living-diorama-spike`, default `?terrain=living`, seed `MOSS-1738`

Evidence: Quality run #39 `r9-1-evidence` artifact, plus the Work Mode cloud-browser preview at 1363 × 936 CSS pixels.

## Comparison setup

- Source image: 1487 × 1058.
- Automated desktop profile: Playwright Desktop Chrome.
- Automated compact profile: Playwright iPhone 14 Pro Max / Mobile Safari profile.
- State: `MOSS-1738`, default fitted camera, onboarding dismissed, simulation paused before capture.
- Compared together: source, desktop Living capture and mobile Living capture were opened in one visual review input.

## Findings resolved

- [P1] The first Living implementation exposed full-cell colour variation as a visible rectangular grid.
  Resolution: land and water now use continuous bases with broad overlapping deterministic washes.

- [P1] The first shoreline followed hard orthogonal cell edges and did not convey the approved diorama direction.
  Resolution: marching-contour curves now carry shadow, sand and highlight shoreline strokes; forest, meadow and deep-water boundaries use softer contour bands.

- [P2] Habitat identity was initially too dependent on tile colour.
  Resolution: forest canopy clusters, grass/meadow marks and water ripples now carry habitat recognition while creatures remain visually above the terrain layer.

No unresolved P0, P1 or P2 finding remains inside the R9.1 technical-spike scope.

## Full-view comparison

- The implementation now has continuous land/water masses, readable curved shoreline, darker forest clusters and a clear open-meadow field. The earlier checkerboard impression is removed.
- Desktop HUD, controls and event cards retain the existing R8 visual system and remain legible over the richer world.
- The mobile crop keeps the top controls, statistics, event card, creation toolbar and speed controls readable without obscuring the primary playfield.
- The implementation is intentionally less illustrative than the concept image: authored foliage, rocks, flowers, elevation, cinematic lighting and redesigned creatures are later R9 work, not acceptance criteria for this spike.

## Focused-region comparison

- Shoreline: land/water separation is continuous and visually layered; no raw tile-edge colour seams remain.
- Forest/meadow boundary: canopy clusters and soft transition bands establish habitat hierarchy without blocking creature silhouettes.
- Creature-over-terrain: grazers and hunters remain higher-contrast than local ground detail in both desktop and mobile captures.
- Water: deterministic low-contrast ripples add surface identity without competing with land creatures or HUD text.

## Interactions and console

- Cloud-browser drag changed the camera position and wheel input changed zoom.
- Water painting advanced `data-terrain-revision` from 0 to 1 and rebuilt the Living terrain in 10.9 ms.
- Initial Living build in the cloud browser measured 24.7 ms.
- No app-origin console warning or error was found.
- GitHub run #39 recorded 31/32 passing journeys; its only failure was the known Chromium headless `ReadPixels` driver warning caused by evidence screenshots. The harness now excludes only that exact browser-driver message and continues to fail on every application warning/error.

## Comparison history

- Iteration 1: deterministic biome detail and shoreline treatment implemented; automated regression passed after static-terrain caching.
- Iteration 2: source/prototype comparison exposed grid-like colour blocking; continuous bases and marching contours replaced the visible cells.
- Iteration 3: same-input source/desktop/mobile review confirmed the spike-level hierarchy and interaction state; performance evidence recorded 93.5% of Classic desktop FPS and 100% of Classic mobile FPS in the throttled CI environment.

## Follow-up polish

- R9.2 can introduce authored creature silhouettes and vegetation assets while preserving the deterministic placement hooks proven here.
- Later R9 phases can add elevation, depth-aware decoration density and cinematic light without altering the simulation model.

final result: passed
