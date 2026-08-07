# R0 Design Gate

## What is ready to review

The prototype is deliberately a playable vertical slice, not a dashboard or static mockup.

| Review area | Evidence in prototype |
| --- | --- |
| World-first composition | Full-viewport terrarium with compact floating controls |
| Emergent behaviour | Grazers forage and flee; hunters pursue; both reproduce under state-based conditions |
| Evolution visibility | Colour, size, speed, vision and efficiency vary and pass to offspring |
| Player agency | Paint meadow, water and forest; grow plants; introduce grazers or hunters |
| Observation | Select an organism to view vitals, behaviour, parents, offspring and genes |
| Mobile intent | Pinch zoom, single-finger pan, touch-sized tool and speed controls |
| Technical foundation | Worker-based fixed-step engine, deterministic seed and versioned IndexedDB snapshot |

## Review questions

1. Does the map feel like the main experience, with data staying secondary?
2. Are grazers and hunters visually readable at normal zoom?
3. Is it satisfying to alter habitat and watch organisms react?
4. Should the final art direction lean more naturalistic, microscopic or stylised?
5. Is the current information density right for phone landscape mode?

## Known R0 limits

- Water is a movement barrier; drinking arrives in R1.
- Species names are fixed until speciation in R3.
- Exact action-log replay and shareable world files arrive in R6.
- Long-press follow mode and soundscape are not included in this gate.
- Population parameters are safe starting values, not final ecological balance.

## Gate recommendation

Proceed to R1 after hands-on review of desktop and phone landscape controls. The architecture already supports later phases without replacing the simulation core or removing R0 features.

