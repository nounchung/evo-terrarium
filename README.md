# EvoTerrarium

Shape a world. Watch life adapt.

EvoTerrarium is a full-screen autonomous ecosystem sandbox. Players change the environment, introduce life and observe feeding, fear, hunting, reproduction, mutation and extinction emerge from deterministic simulation rules.

## Current vertical slice (R5)

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
- Full-screen PixiJS rendering with pan, wheel zoom and pinch zoom
- Touch-friendly creation tools for terrain, resources and creatures
- Inspectable organisms with vitals, meals, drinks, hunts, lineage and inherited traits
- Web Worker simulation and IndexedDB auto-save

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

See [Simulation Design Spec](docs/simulation-design.md), [R0 Design Gate](docs/r0-design-gate.md), [R1 Validation](docs/r1-validation.md), [R2 Validation](docs/r2-validation.md), [R3 Validation](docs/r3-validation.md), [R4 Validation](docs/r4-validation.md) and [R5 Validation](docs/r5-validation.md).

## Roadmap

R0 through R7 are tracked as GitHub issues. Each phase retains the capabilities from earlier phases; diagnostic views will move into an optional Lab Mode rather than being removed.

## Cost and deployment

The app has no backend and no paid AI dependency. The Vite output in `dist/` can be deployed directly to Vercel.
