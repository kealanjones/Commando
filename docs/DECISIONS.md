# Decisions

Design and architecture calls for the work register.

Revised after the first design checkpoint, which was rejected as overcrowded, too
maximalist and not intuitive. The superseded first pass is in
`docs/DECISIONS-v1.md`. The single most useful piece of that feedback: every
section of v1 carried an explanatory caption, and a caption is proof the section
was not self-evident. All of them are gone.

## Structure — three destinations

Conventional navigation beats novelty here.

- **Today** — what to do. The only screen that opens by default.
- **Streams** — where all ~190 items live, by stream and section.
- **Periphery** — the "needs remembering" register, kept physically separate so
  it can never ask anything on a given morning.

## Today

The whole screen, in order:

1. Date, and a single count of what is open.
2. **Three tasks.** Eighteen items carry a do-now flag, which is a week rather
   than a morning. The three shown are the ones with real pressure behind them —
   a date, a departing flight, a queue of blocked work. The remaining fifteen are
   one tap away behind a plain line of text.
3. **Last touched.** Five rows, one per stream.

Nothing else. No captions.

## Last touched — answering "what is falling behind"

One bar per stream. It runs from the left and ends at the last time that stream
was touched; the right-hand edge is today. Long bar, you are on top of it. Short
bar, you are not. A day count sits at the right in mono.

There is nothing to learn and no legend. The v1 version of this — activity marks,
hatched silence regions, a lit live edge, an axis and a paragraph explaining all
of it — was the single densest thing on the page and needed the most explaining.
Same idea, one line.

A stream with no data renders as a dashed rule rather than a short bar, since a
short bar would falsely read as a long silence.

Rejected alternatives remain rejected: progress bars, percentage complete, health
scores and gauges all need a denominator, and ISODP cannot be "completed".
Recency of contact is the only honest signal available.

## Doing versus remembering

Separated by destination, not by decoration. Tasks live in Today and Streams and
carry a checkbox. Periphery items have no checkbox at all — a checkbox is a
demand, and these items are not permitted to make demands. Promoting one moves it
into its stream, and that move is the one piece of motion in the app that is
allowed to be noticeable.

## Colour

Dark, committed — not a toggle. Ground `#0F1315`.

| Stream | Hex |
|---|---|
| `cttl` Commonwealth | `#D9A04A` |
| `isodp` ISODP 2027 | `#4FA8C0` |
| `dir` Directorate | `#8A8FD4` |
| `career` Career | `#D97A97` |
| `per` Personal | `#6BB48F` |

The hue appears **once per row** — the checkbox in a list, the bar in Last
touched. In v1 it drove six things at once, which is what made the screen shout.
Five streams stay distinguishable; nothing competes.

## Type — two faces, two jobs

- **Newsreader** (serif) — task titles and headings. They are sentences a person
  wrote, and a serif says so. Also stops the tool reading as a form.
- **IBM Plex Mono**, tabular figures — every date, count, name-waited-on and
  label.

The brief asked for reading text and data to look different. Serif against mono
is the crispest available version of that: they are distinguishable without
reading either.

## Computed rather than tracked

- **Staleness** — days since the last write touching a stream or section. Drives
  Last touched. Never entered.
- **Waiting-on** — names extracted from titles at seed time into a real table, so
  "chase X for Y" becomes a queryable dimension. Shown inline on a task, and a
  filter on Streams.
- **Blocking** — derived from section membership, e.g. the payment escalation
  email has nine items behind it.
- **Date absence** — 1 of ~190 items carries a date. Surfaced on Streams rather
  than shouted on Today.

## Section groupings

The brief's own sections are kept as the storage structure — they are meaningful
and the user thinks in them. Waiting-on and staleness are alternative traversals
of the same rows, which is why the model is `stream → section → task` plus a
separate `task_person` relation.

## Stack

- **Vite + React + TypeScript + Tailwind.** No server rendering worth having: one
  authenticated user, everything behind RLS. An SPA gives a cleaner
  installable-PWA and service-worker story than Next, with less machinery.
- **TanStack Query** with optimistic mutations and a mutation queue persisted to
  IndexedDB — the Underground requirement. A genuinely failed write surfaces
  rather than vanishing.
- **Supabase** — Postgres, RLS enabled in the first migration, realtime on tasks
  so phone and laptop agree. Idempotent seed keyed on `section_id:slug(title)` so
  the seed file can be edited and re-run without destroying user edits.
- **Soft delete** throughout, so undo works.
