# R1 Food Chain Validation

## Delivered scope

R1 turns the R0 living-world prototype into a complete, observable survival loop while retaining the same world-first interface.

| System | R1 behaviour |
| --- | --- |
| Hunger and metabolism | Movement and body traits consume energy; low energy damages health; feeding restores energy |
| Hydration | Creatures lose water over time, seek cached shoreline points and visibly drink from land |
| Plant resources | Plant energy regrows with a local density penalty, creating resource competition |
| Predation | Hunters pursue only when useful, attack on cooldown and gain energy from a successful kill |
| Reproduction | Two living parents must be mature, fed and hydrated; births pay energy and water costs |
| Population balance | Viable plants bound grazers; prey numbers bound hunters; hard caps remain a final guardrail |
| Extinction pressure | Low predator numbers increase mating urgency and permit a two-offspring litter without creating organisms from nothing |
| Explainability | Individual meal, drink and hunt counts plus a bounded death-cause ledger explain population changes |

## Automated acceptance evidence

- Deterministic initial world for identical Seeds
- Three different Seeds each run for 1,200 simulated seconds (twenty minutes)
- Grazers and hunters remain present after each twenty-minute run
- Creature and plant counts remain below their hard caps
- Coordinates and hydration remain finite
- Births and deaths both occur
- Every death is classified as predation, starvation, dehydration or age
- A thirsty isolated grazer reaches and drinks from a shoreline
- R0 snapshots receive safe defaults for every new R1 field
- JSON save and restore remains lossless after migration

## Design review focus

1. Can a player understand that the water-drop marker means a creature is seeking water?
2. Does the selected-creature card expose enough survival context without covering too much of the world?
3. Does the `balanced`, `stressed` or `fragile` food-web label match what is visibly happening?
4. At 20× and 100×, are feeding, drinking, births and extinctions still readable rather than merely fast?

## Known limits

- This validation proves bounded behaviour for a fixed Seed suite; it does not claim every possible world will avoid natural extinction.
- Death records are intentionally limited to the latest 80 entries until the R6 replay system adds a durable action and event log.
- Predator mating calls model long-range scent or calls abstractly; territory and social memory arrive in R5.
- Browser visual and physical touch-device QA still require an environment with a launchable browser.

