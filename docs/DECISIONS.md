# Decisions

Design and architecture calls for the work register.

Revised twice at the design checkpoint stage.

- **v1** was rejected as overcrowded, too maximalist and not intuitive. Kept in
  `docs/DECISIONS-v1.md`. Its most useful lesson: every section carried an
  explanatory caption, and a caption is proof the section was not self-evident.
- **v2** stripped it back to a dark, near-monochrome register with two typefaces.
  Structurally right, aesthetically wrong.
- **v3, current** — a bright, soft, playful light theme, set by a mobile
  task-app reference the user supplied. The structure and the computed signals
  from v2 all survive; only the register changed.

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
3. **The stream card row.** Five bright cards, each with a count and a recency
   dial. Horizontally scrollable on phone, a five-up grid on desktop.
4. **One nudge line.** "1 of 190 items has a date" with an action to fix it. The
   single most useful fact about the register, stated once.

Nothing else. No captions.

The greeting header ("Hi, Kealan", the date, an avatar, an add button) comes from
the reference and earns its place — it makes the tool feel personal rather than
administrative, which matters for something opened at 7am.

## The recency dial — answering "what is falling behind"

Each stream is a bright rounded card carrying its own colour. On it sits a dark
circular badge with the stream's open count, and **around that badge runs a ring
showing recency**: full when the stream was touched today, emptying as it goes
quiet, against a 21-day scale. A short line underneath says it in words — "quiet
11 days", "touched today".

This is the third attempt at the same idea and the first one that needs no
explanation. v1 drew activity marks, hatched silence and a live edge on a
28-day axis. v2 reduced that to a bar ending where activity stopped. v3 folds it
into the count badge itself, so one glance at the card row answers both "how big
is this" and "am I on top of it".

The ring has no denominator problem — it measures time since last contact, not
completion. That matters because ISODP cannot be "completed" and any
percentage-done metric would be fiction. Progress bars, health scores and gauges
stay rejected for that reason.

A stream with no data yet renders as a pale tinted card with a dashed ring and an
em dash, which is visually distinct from a stream that had activity and stopped.

Rejected alternatives remain rejected: progress bars, percentage complete, health
scores and gauges all need a denominator, and ISODP cannot be "completed".
Recency of contact is the only honest signal available.

## Doing versus remembering

Separated by destination and by surface treatment. Tasks are solid white cards
with a soft shadow and a round checkbox. Periphery items — shown as **Keeping an
eye on** — are dashed-border, tinted-fill, shadowless, and carry **no checkbox at
all**. A checkbox is a demand, and these items are not permitted to make demands.

*Make a task* is the only way out of the periphery. The conversion is the one
piece of motion in the app allowed to be noticeable: the card pops, its border
goes solid, it gains a shadow and the text steps up to full weight.

## Colour

Light, committed — not a toggle. Ground `#F2F4F9`, a warm-cool off-white rather
than grey. Cards `#FFFFFF`. Ink `#16181F`.

Each stream carries three tokens: a bright fill, a deep variant for text on
tints, and a pale tint for pills and hover states.

| Stream | Fill | Deep | Tint |
|---|---|---|---|
| `cttl` Commonwealth | `#FFB84D` | `#9A5A00` | `#FFF1DC` |
| `isodp` ISODP 2027 | `#7FA6F5` | `#26499F` | `#E6EDFE` |
| `dir` Directorate | `#B49BF0` | `#54309E` | `#EFE9FE` |
| `career` Career | `#FF9BBE` | `#A81E52` | `#FFE8F0` |
| `per` Personal | `#6FDCB0` | `#0B6A48` | `#E0F8EE` |

The fills are pitched light enough that dark ink sits on them legibly, which is
what keeps the palette soft rather than shouty. Contrast comes from the near-black
count badges, not from the colour.

The colour is **structural, not accent**: a whole stream card takes the hue, and
the same token drives that card, the task checkbox, the stream pill, the
periphery border and the focus ring. Five identities rather than one blue accent
is the main thing separating this from the template look the brief warned against.

## Type — two faces, two jobs

- **Plus Jakarta Sans** — everything read as language. Geometric and friendly at
  400–600, genuinely chunky at 800 for the greeting, section heads and the count
  badges.
- **DM Mono** — every date, count, code, label and name-waited-on. Softer than
  Plex Mono, which suits the register.

The brief asked for reading text and data to look different. Rounded geometric
sans against a soft mono keeps that distinction while staying in the bright,
playful world.

## Motion

Four moments, all meaningful, all disabled under `prefers-reduced-motion`:

1. Stream cards rise and fade in on load, staggered.
2. Each recency ring sweeps to its value after the cards land.
3. Completing a task pops the checkbox and settles the card back.
4. Promoting a periphery item pops the card and resolves its dashed border.

No ambient decoration.

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
