# Simulation Design Spec

Status: R2 genealogy foundation, version 3
Decision: R1 Design Gate approved; R2 inheritance and lineage implemented for validation

## 1. Experience contract

The world must feel alive without player micromanagement. Every visible movement is produced by simulation state, not a scripted animation. The player changes conditions; organisms decide how to respond.

The screen remains world-first:

- The PixiJS terrarium occupies the full viewport.
- Persistent UI is limited to compact glass overlays.
- Detailed information appears only after selecting a creature.
- Creation tools are reachable with a thumb and collapse naturally on small screens.

## 2. Runtime boundaries

| Boundary | Responsibility | Must not own |
| --- | --- | --- |
| Simulation engine | Terrain, entities, genes, decisions, lifecycle, deterministic random stream | DOM, React, PixiJS |
| Web Worker | Fixed timestep, speed multiplier, snapshots, world commands | UI layout |
| React | HUD, tools, selection, dialogs, accessibility | Ecological rules |
| PixiJS | Terrain and entity rendering, pan/zoom gestures | Source-of-truth state |
| IndexedDB | Versioned local world snapshot | Simulation logic |

The worker is authoritative. UI actions are commands; they never mutate a rendered snapshot directly.

## 3. Determinism

- The string seed is hashed into a 32-bit pseudo-random state.
- Terrain uses coordinate-based seeded value noise, so generation order cannot alter the landscape.
- Entity creation and mutation use a serializable random state.
- The engine advances in fixed `0.05`-second steps.
- World snapshots include schema version, tick, entity IDs, random state and terrain revision.

Same seed guarantees the same initial world. Exact replay after player actions will be completed in R6 with an ordered action log.

## 4. World model

The R0 world is 1,440 × 900 logical units with 40-unit terrain cells.

| Biome | Traversable | Resource profile | Visual role |
| --- | --- | --- | --- |
| Deep water | No | Future aquatic system | Dark channels and lakes |
| Water | No | Drinking from adjacent land cells | Shoreline, survival resource and barrier |
| Meadow | Yes | Fast plant growth | Bright open feeding areas |
| Grass | Yes | Moderate growth | General habitat |
| Forest | Yes | Dense, slower growth | Cover and visual structure |

Painting terrain increments `terrainRevision`; PixiJS only rebuilds the terrain layer when that value changes.

## 5. Organism model

Every organism stores identity, species, position, age, health, energy, hydration, behaviour, life-history counters, parents, offspring, heritable genes and mutation evidence. A separate durable genealogy record preserves those relationships after death.

| Gene | Phenotype / rule effect | Initial bounded range |
| --- | --- | --- |
| Speed | Travel and chase/flee velocity | Species-specific |
| Vision | Resource, threat and mate search radius | 55–240 |
| Size | Rendered body and metabolic cost | 0.58–1.70 |
| Metabolism | Passive energy consumption | 0.45–1.80 |
| Fertility | Reproduction cooldown | 0.45–1.60 |
| Hue | Visible body colour variation | −40–40 |

Offspring select each gene from one of two parents. Each gene has a bounded mutation chance and magnitude. The phenotype is rendered directly from the gene values.

## 6. Decision model

R0 uses Utility AI priorities with a short decision interval:

### Grazer

1. Flee a visible hunter.
2. Seek a reachable shoreline when critically thirsty.
3. Seek a mature plant when energy is below target.
4. Drink before mating when moderately thirsty.
5. Seek a compatible mate when mature, fed, hydrated and below carrying capacity.
6. Wander or rest.

### Hunter

1. Seek a reachable shoreline when critically thirsty.
2. Chase and attack visible grazers when hungry.
3. Seek a compatible mate when mature, fed, hydrated and below carrying capacity.
4. Use a long-range mating call when predator numbers are dangerously low.
5. Wander or rest.

Movement and decision frequency are separate. This keeps paths smooth while avoiding a full AI search every render frame.

## 7. Spatial performance

Creatures, plants and cached shoreline drinking points are bucketed into 120-unit spatial cells. Perception and resource searches inspect neighbouring buckets instead of the whole world. The sparse-predator mating call deliberately searches farther to avoid accidental isolation. Caps remain 240 creatures and 260 plant nodes.

## 8. Stability rules

- Hard caps remain a final safety boundary; dynamic carrying capacity limits grazer numbers by viable plants and hunter numbers by available prey.
- Reproduction requires two mature, energetic and hydrated organisms and applies energy, water and cooldown costs.
- Critically low predator populations receive a reproductive urgency bonus and can produce a two-offspring litter, but still require two living parents; there are no scripted respawns.
- Plant nodes regrow under local density competition and new wild nodes appear at a bounded interval.
- Invalid or water movement redirects an organism rather than corrupting its position.
- Age, starvation, dehydration and predation are explicit death paths stored in a bounded death ledger.
- Predator attacks use cooldowns so contact does not apply damage every AI decision tick.

R3 will use accumulated genetic distance and common ancestry to model deterministic speciation.

## 9. Persistence and compatibility

World schema version `1` remains stored in IndexedDB. R1 normalises R0 snapshots by adding hydration, combat and death-ledger defaults so existing local worlds continue safely. Future incompatible changes require explicit migration functions; UI-only state such as open panels is not persisted.

## 10. Test strategy

- Same-seed equality for terrain and initial entities
- Three fixed Seeds complete twenty simulated minutes with both trophic levels alive and within caps
- Drinking and explicit death-cause tests
- R0 snapshot compatibility test
- JSON serialization round-trip preserves state
- Player commands change the intended authoritative state
- Playwright smoke flows at desktop Chromium and mobile Safari emulation
- Visual QA at desktop and phone viewport sizes
