# EvoTerrarium

塑造一個世界，觀察生命自行適應與演化。

EvoTerrarium is a full-screen autonomous ecosystem sandbox. Players change the environment, introduce life and observe feeding, fear, hunting, reproduction, mutation and extinction emerge from deterministic simulation rules.

## Complete vertical slice (R8)

- Traditional Chinese (`zh-HK`) interface by default, with persistent English switching
- Localized onboarding, tools, organism details, species, genealogy, climate, social lab, archive, accessibility labels and dynamic world events

- Seeded water, meadow, grass and forest generation
- Autonomous plants, grazers and hunters
- Utility-based foraging, fleeing, hunting, mating and resting
- Hunger, energy, hydration, health, ageing and explicit death causes
- Shoreline drinking, resource competition and habitat-driven plant regrowth
- Predator attack cooldowns, successful-hunt records and low-population mating calls
- Dynamic carrying capacity that balances plants, grazers and hunters without scripted respawns
- Two-parent gene crossover and mutation across generations
- Durable genealogy across living and deceased organisms
- Inspectable mutation history with notable-change markers
- Gene-driven body colour, scale, ears, legs, tails and markings
- Genetic-distance mating compatibility and deterministic speciation
- Common-ancestor species records with population trends and extinction history
- Species codex with factual selection-pressure evidence from the current world
- Deterministic temperature, rainfall, soil moisture, day/night and four seasons
- Seed-driven and player-placed drought, flood, disease and wildfire regions
- Visible disaster fronts, bounded survival effects, recovery events and lasting habitat change
- Six-slot short-term spatial memory for food, water, threats and shelter
- Locally formed herds and packs with cohesion, leadership and pack territories
- Resource-, climate- and threat-scored herd migration routes
- Optional Social Lab for live group, territory, route and memory debugging
- Versioned IndexedDB auto-save with six named world slots and v1 migrations
- Deterministic tick-stamped player action log and seed-based timeline reconstruction
- Durable ecological landmarks for replay navigation
- Validated portable JSON world records with import and export
- Shareable seed URLs that reproduce terrain and founding populations
- Full-screen PixiJS rendering with pan, wheel zoom and pinch zoom
- Touch-friendly creation tools for terrain, resources and creatures
- Inspectable organisms with vitals, meals, drinks, hunts, lineage and inherited traits
- Web Worker simulation and IndexedDB persistence
- Opt-in procedural Web Audio soundscape driven by water, rain, season, population and world events
- First-run, keyboard-accessible onboarding with an explicit silent path
- Reduced-motion-aware environmental polish, seasonal light and creature movement
- Adaptive canvas resolution for smoother rendering on high-density mobile displays

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown by Vite. For a production build:

```bash
npm run check
npm run build
```

## Architecture

The deterministic simulation engine contains no React or PixiJS code. A Web Worker advances it with a fixed timestep and sends serializable snapshots to the UI. React owns controls and overlays; PixiJS renders the living world; IndexedDB persists snapshots locally.

See [Simulation Design Spec](docs/simulation-design.md), [R0 Design Gate](docs/r0-design-gate.md), [R1 Validation](docs/r1-validation.md), [R2 Validation](docs/r2-validation.md), [R3 Validation](docs/r3-validation.md), [R4 Validation](docs/r4-validation.md), [R5 Validation](docs/r5-validation.md), [R6 Validation](docs/r6-validation.md) and [R7 Validation](docs/r7-validation.md).

## Roadmap

R0 through R8 are complete. Each phase retains the capabilities from earlier phases; diagnostic views live in optional Lab surfaces rather than interrupting the core observation experience.

## Cost and deployment

The app has no backend and no paid AI dependency. The Vite output in `dist/` can be deployed directly to Vercel.
