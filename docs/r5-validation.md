# R5 Validation

Status: implementation complete; automated and Jason-mode visual gate required before merge

## Scope

- Bounded spatial memory for food, water, threats and forest shelter.
- Herds and packs formed from local proximity with living leaders and cohesion radii.
- Pack territories with overlap pressure and patrol behaviour.
- Herd migration chosen from scored resources, climate hazards and predator pressure.
- Optional live Social Lab with group, territory, route and selected-memory evidence.

## Acceptance evidence

- Vitest covers deterministic group formation, climate-driven migration, bounded memory, legacy migration and three-seed long-run ecosystem survival.
- Playwright covers Social Lab discovery, live-speed semantics and core diagnostic sections.
- Production build and lint run from a clean checkout.
- Jason-mode review checks that diagnostic overlays are legible, optional and subordinate to the living world.

## Safety boundaries

- Memory is capped at six locations and expires after eight simulation days.
- At most twenty-four living groups and forty recent migration records are retained.
- Group directives never outrank urgent thirst, hunger, threat response or viable reproduction.
- Hunter packs patrol prey-bearing territories; only herds perform long resource-scored migration.
