# How the master list became the register

The seed in `data/register.seed.ts` is built from the Master Work Action List.
It is a faithful transcription, but a few judgement calls were needed and they
are recorded here so they can be reversed.

## Counts

| Stream | Tasks | Watch | Total |
|---|---:|---:|---:|
| Commonwealth Tribute to Life | 24 | 6 | 30 |
| ISODP 2027 | 114 | 31 | 145 |
| Directorate | 49 | 14 | 63 |
| Career | 7 | 3 | 10 |
| Personal | 7 | 0 | 7 |
| **Total** | **201** | **54** | **255** |

33 sections. 24 items flagged *do now*. **One** item carries a date.

The original brief estimated ~190 with ~50 to remember. The consolidated master
list is simply larger than the partial version the brief carried; the watch
count is almost exactly as predicted.

## Judgement calls

**Sub-bullets.** Where a bullet enumerated distinct actions, each became an item.
Where it enumerated the *contents* of one action — "Clarify: invoicing, bank
details, international transfers…" — it became a note on a single item, so the
list does not inflate with fragments that cannot be finished independently.

**The KEEP TABS block became `watch` items**, attached to the section they
belong to rather than sitting in a list of their own. That way "Getinge" as a
live thread sits with the Getinge tasks, and promoting it puts it exactly where
it belongs.

**Section 10, the OTDT and Clinical Services restructure**, is flagged
`monitor: true` and holds **no tasks at all** — all nine entries are watch items.
The list itself says it is "mostly a Keep Tabs area rather than active delivery",
and the nine entries are things to track, not to do. Its three summary entries in
KEEP TABS were dropped as duplicates of the detail here.

**Two items were already present** and were not duplicated. Section 11 repeats
"Review ARC Discovery slides and data" and "Read / AI-analyse Journey to Equity",
both of which already sit in CTtL → Reading and development. Only the genuinely
new part — connecting those findings to referral pathways, equity, digital
opportunities and operational feasibility — was added to the Directorate section.

**"Keep current donation performance pressures in mind"** became a watch item
rather than a task. It is not something that can be finished.

**Grassroot and Property** are in the Personal stream. The master list says to
keep them out of the work list, and a separate stream is exactly that: they never
mix with work in any view, and Personal has its own colour and its own dial.

**The one date.** "Submit the nomination internally to Kate Thomas and Wayne
Norleigh" carries `due: 2026-08-28`. The other six honours items are flagged
*do now* but undated, so the register still has exactly one real deadline — which
is the fact the home screen surfaces.

## Re-seeding

This file is the source of truth. Edit it, run `npm run seed`, and the database
reconciles: new items inserted, changed wording updated, removed items
soft-deleted — but never anything you have edited, completed, or created
yourself. See the re-seeding table in the README.
