# EvoTerrarium

Shape a world. Watch life adapt.

EvoTerrarium is a full-screen autonomous ecosystem sandbox. Players change the environment, introduce life and observe feeding, fear, hunting, reproduction, mutation and extinction emerge from deterministic simulation rules.

## Current vertical slice

- Seeded water, meadow, grass and forest generation
- Autonomous plants, grazers and hunters
- Utility-based foraging, fleeing, hunting, mating and resting
- Energy, health, ageing, death and bounded population growth
- Two-parent gene crossover and mutation across generations
- Full-screen PixiJS rendering with pan, wheel zoom and pinch zoom
- Touch-friendly creation tools for terrain, resources and creatures
- Inspectable organisms with vitals, lineage and inherited traits
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

See [Simulation Design Spec](docs/simulation-design.md) and [R0 Design Gate](docs/r0-design-gate.md).

## Roadmap

R0 through R7 are tracked as GitHub issues. Each phase retains the capabilities from earlier phases; diagnostic views will move into an optional Lab Mode rather than being removed.

## Cost and deployment

The app has no backend and no paid AI dependency. The Vite output in `dist/` can be deployed directly to Vercel.

