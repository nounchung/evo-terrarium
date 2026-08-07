# R3 Validation

Status: implementation complete; automated and Jason-mode visual gate required before merge

## Scope

- Normalized gene distance controls mate compatibility and species assignment.
- Generation-five divergent offspring can found a deterministic named species once the parent population is viable.
- Species retain founding signatures, ancestry, population trend, peak population and extinction day.
- The codex reports observed world facts rather than invented evolutionary causes.
- Opening the codex pauses the world and closing it restores the exact previous speed.

## Acceptance evidence

- Vitest covers deterministic forced speciation, compatibility, restored-state migration and long-run ecosystem stability.
- Playwright covers codex discovery, pause semantics, core content and speed restoration.
- Production build and lint run from a clean checkout.
- Jason-mode visual review checks desktop and mobile hierarchy, legibility, clipping, interaction targets and world-first composition on the deployed preview.

## Safety boundaries

- At most twelve living species per creature kind may exist at once.
- Existing R2 genealogy snapshots receive base species identifiers during restoration.
- Population histories retain the latest eighty daily samples per species.
