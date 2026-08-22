# Decisions

Design and architecture calls made in response to the open questions in the brief.
Design checkpoint published for review before building outward.

> **Revised after the first design checkpoint.** The first pass was rejected as
> overcrowded, too maximalist and not intuitive. That was fair: every section
> carried an explanatory caption, which is proof it was not self-evident. The
> sections below record the revised design; the superseded first pass is kept in
> `docs/DECISIONS-v1.md` for reference.

## The home screen

Answers the brief's two questions in order, across three destinations rather than
one long adaptive surface. Conventional navigation is more intuitive here than
novelty.

1. **The dated slab.** The single genuinely dated item, rendered as a solid field
   of its stream's colour with a large day count. Directly under it, a permanent
   line stating how many of the items carry a date at all. The absence is
   presented as data, because the absence is the root cause of everything reading
   as equally urgent.
2. **Do now.** Capped at five, selected by date pressure and stream drift rather
   than by flag alone — 18 items carry a do-now flag, which is a week rather than
   a morning, and the screen says so.
3. **The Drift.** See below.
4. **Waiting on.** Names as a cross-stream cut, since a large share of the work
   is chasing people.
5. **The periphery.** The "needs remembering" register.

## The Drift — the one memorable element

Five horizontal lanes, one per stream, over a rolling 28-day window ending today.

- Each mark is a write touching that stream. Marks are derived from `updated_at`,
  never entered.
- The run between the last mark and today is drawn as hatched **silence**, to
  scale, labelled in days.
- A healthy lane runs its colour to the right-hand edge and caps it with a lit
  bar. A drifting lane stops early and the emptiness is the signal.
- **Lane height encodes item volume.** This is what makes the very uneven stream
  sizes (ISODP 110+, Property 1) legible rather than looking broken.
- A stream with no data yet renders as a dashed empty track, which is visually
  distinct from a stream that had activity and stopped.

Rejected alternatives: progress bars, percentage complete, health scores, gauges.
All require a denominator. ISODP cannot be "completed" — there is no meaningful
total — so any completion metric would be fiction. Recency of contact is the only
honest available signal.

## Doing versus remembering

Two visual registers, not two labels.

| | Task | Periphery item |
|---|---|---|
| Ground | solid | hatched |
| Dividers | solid hairline | dashed |
| Marker | square checkbox | open ring, **no way to tick it** |
| Text | full contrast, 14.5px | one step down, 13.5px |
| Left edge | hard keyline | none |

A checkbox is a demand. Periphery items are not permitted to make demands. The
transition between the two states is the app's one piece of ceremony: the row
pulls left, the ring fills, the text steps up to full weight, the item lands in
its stream.

## Colour

Dark, committed — not a toggle. Ground `#0C1013`, a cold ink rather than neutral
grey. Five stream identities:

| Stream | Hex |
|---|---|
| `cttl` Commonwealth | `#E0A03A` |
| `isodp` ISODP 2027 | `#3FB6D2` |
| `dir` Directorate | `#9095EC` |
| `career` Career | `#E86F98` |
| `per` Personal | `#63BE94` |

The hue is structural, not a dot: it drives the row keyline, the checkbox ring,
the tag chip, the drift lane, the count, and the waiting-on chip. Six touchpoints
from one variable.

Severity is deliberately not a sixth hue. Urgency is carried by **inversion** —
the dated slab is a solid field of the stream's own colour — so nothing competes
with the identity system.

## Type

Three faces, three jobs, so reading text and data are never confusable.

- **Fraunces** — display, stream names, all counts. Numbers get weight and
  character instead of being small grey text.
- **Instrument Sans** — anything read as a sentence. Nothing else.
- **IBM Plex Mono**, tabular figures — dates, counts, currency, codes,
  waiting-on names. If it is data, it is monospaced.

## Computed rather than tracked

- **Staleness** — days since the last write touching a stream or section.
- **Waiting-on** — names extracted from titles at seed time into a real table, so
  "chase X for Y" becomes a queryable dimension rather than a phrase.
- **Blocking** — derived from section membership, e.g. the payment-process
  escalation email blocks the nine items behind it.
- **Date absence** — surfaced permanently on the home screen.

## Section groupings

The brief's own sections are kept as the storage structure — they are meaningful
and the user thinks in them. But they are not the only cut: waiting-on and
drift are alternative traversals of the same rows, which is why the model has
`stream → section → task` plus a separate `task_person` relation.

## Stack

- **Vite + React + TypeScript + Tailwind.** No server rendering worth having:
  one authenticated user, everything behind RLS. An SPA gives a cleaner
  installable-PWA and service-worker story than Next, with less machinery.
- **TanStack Query** with optimistic mutations and a mutation queue persisted to
  IndexedDB — the Underground requirement. A genuinely failed write surfaces
  rather than vanishing.
- **Supabase** — Postgres, RLS enabled in the first migration, realtime on tasks
  so phone and laptop agree. Idempotent seed keyed on `section_id:slug(title)`
  so the seed file can be edited and re-run without destroying user edits.
- **Soft delete** throughout, so undo works.
