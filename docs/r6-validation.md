# R6 Validation

Status: implementation complete; automated and Jason-mode visual gate required before merge

## Scope

- Simulation schema v2 with safe migration from existing v1 IndexedDB worlds.
- Six named local save slots with explicit restore, export and delete actions.
- Tick-stamped player action log and deterministic reconstruction from the founding seed.
- Durable ecological landmarks for timeline navigation and replay playback.
- Validated portable JSON world records plus reproducible seed links.

## Acceptance evidence

- Vitest compares a reconstructed world to the complete live state after multiple timed player interventions.
- Vitest covers portable-record round trips, damaged file rejection and canonical seed URLs.
- Playwright covers named saves, landmark replay, return-to-live semantics and the share surface.
- Production build and lint run from a clean checkout.
- Jason-mode review checks archive hierarchy, replay status clarity, destructive-action affordance and mobile fit.

## Safety boundaries

- Imports require the EvoTerrarium record signature, supported format version and a structurally valid v2 world.
- Replay never mutates the preserved live snapshot; leaving replay restores it exactly.
- Auto-save is suspended during replay so historical reconstructions cannot replace the live world.
- Seed links include only the seed, not local saves or full world state.
