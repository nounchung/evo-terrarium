# R2 Genes, Inheritance and Genealogy Validation

## Delivered scope

R2 makes evolution inspectable across living and dead organisms without changing the autonomous rules established in R1.

| System | R2 behaviour |
| --- | --- |
| Inheritance | Each child receives one bounded value per gene from either parent before mutation |
| Mutation evidence | Every changed gene records its inherited value, resulting value, percentage change and significance |
| Durable genealogy | Founders, descendants and deceased organisms remain in a version-compatible family archive |
| Family links | Parents and offspring update both the live organism and durable genealogy records |
| Phenotype | Size, colour, vision, speed and fertility affect body scale, hue, ears or crest, legs or tail, and markings |
| Discovery | The Generation statistic opens the latest living lineage directly |
| Inspection | A genealogy panel presents grandparents, parents, subject, offspring and mutation explanations |

## Acceptance evidence

- Same-seed worlds retain deterministic initial genes and phenotypes.
- A multi-generation run produces two-parent descendants and bounded mutation records.
- Living organisms have matching durable genealogy records.
- Save and restore preserves the full genealogy archive.
- R1 worlds without genealogy, mutation or birth-day fields migrate safely.
- Notable mutations create factual world events and a visible gold marker above the organism.
- Desktop preview must expose the genealogy from the Generation control without requiring a precise canvas click.

## Jason mode review focus

1. Is genealogy discoverable from the world view?
2. Can a player distinguish living and dead ancestors?
3. Do mutations explain a visible difference rather than present raw data only?
4. Does the panel preserve the world-first layout and remain usable on mobile?

## Design Gate correction

The first deployed review showed the organism card and event feed through the genealogy glass, producing overlapping text. The final gate hides the organism card while genealogy is open and gives the genealogy surface an opaque layered background; the ecosystem remains visible across the other two thirds of the screen.
