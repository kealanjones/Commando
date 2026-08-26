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

## Intake — reading a meeting record into the register

Added after the first deployment pass. Paste notes or a transcript; get proposed
items; accept what is real.

### Where it runs, and why that is not negotiable

In a Supabase Edge Function, never the browser. The Supabase anon key ships in
the bundle and is safe because RLS bounds what it can reach. An Anthropic API
key is bounded by nothing — anyone who reads it can spend against it. So it
lives as a function secret and the browser never sees it.

The function forwards the caller's own JWT to PostgREST rather than using the
service role, so every read and write it performs is bounded by exactly the same
policies as the app itself.

### Extraction proposes, the user disposes

Nothing extracted is written to `tasks`. Candidates go to `intake_items` and stay
there until accepted. This is not caution for its own sake: the register exists
because a list where everything looks equally urgent is useless, and the fastest
way to rebuild that problem would be to let a model add forty items a week
unsupervised.

Three consequences in the design:

1. **Unplaceable items stay unplaced.** If the model cannot route something into
   a real section, it comes back marked and is excluded from the ready count. A
   confident guess into the wrong stream is worse than a visible gap.
2. **Every proposal carries its evidence** — a verbatim quote from the source.
   That turns review into a two-second check rather than a re-read. The prompt
   refuses to extract anything it cannot quote.
3. **The routing is validated server-side.** A section id the model invented is
   discarded and the item treated as unplaced, rather than written into a column
   with a foreign key.

### The bias is towards watching

The prompt states the asymmetry explicitly: a false task nags every morning, a
false watch item is merely quiet. When the model is unsure whether something is
work or context, it must choose watch. This is the doing-versus-remembering
distinction from the original brief, applied to extraction — the feature would
undermine the register if it defaulted the other way.

### Duplicates

Existing open titles are passed as grounding and the model flags anything that
restates one. Half of what comes out of a meeting is already on the list, and
silently adding a second copy is how a register stops being trusted.

### Prompt caching

The system prompt and the grounding block (streams, sections, open titles) are
stable between runs and carry cache breakpoints; the transcript goes last, after
them. Ordinary practice, but it matters here because the grounding block grows
with the register.

### Privacy of the source

`intakes` and `intake_items` are owner-only, with no share path at all — unlike
tasks, which a stream member can see. A meeting record routinely covers more
than the one workstream a collaborator was given access to, so the transcript
must not travel with the stream.


## The web — why a map, and why of sections

The register answers "what must I do today" with a list, and a list is the right
shape for that. It is the wrong shape for the second question, and worse than
useless for a third that only appeared once there were 255 items: *what is
actually connected to what*.

### A node is a section, not a task

Two hundred and fifty-five nodes is a hairball — technically a graph, practically
a smudge, and no one has ever learned anything from one. Thirty-three is a map
you can hold in your head. It also matches how the work is actually thought
about: not "chase Belaal", but "the Australia business".

### The edges are people and threads, and nothing else

Both are already in the database and both mean something specific. A shared
person is *observed* — the seeder extracted the name from the title. A shared
thread is *asserted* — you agreed to a grouping. So a thread pulls twice as hard
as a name, and is drawn solid where a name is drawn dashed. Anything else that
could have been an edge (same stream, similar words) is either already visible in
the filing or a guess dressed as a fact.

### Fading rather than a staleness badge

The recency dial answers "how quiet is this stream". The web answers it a level
down, for all thirty-three sections at once, and it cannot do that with numbers —
thirty-three figures is a table, not a picture. So colour drains out of a section
as the days since it was touched pile up. Neglect stops being something you audit
and becomes something you notice.

A register with no history reads as *no evidence*, not as *abandoned*: a fresh
install opens at full colour. Making a brand-new register look neglected would be
both wrong and discouraging.

### Three arrangements, not three features

Filed, connected and under pressure are the same dots under different forces, and
the move between them is the argument. Watching Australia and Sydney leave the
Commonwealth pile and settle next to Office says something no static picture of
either arrangement says on its own. The move plays itself once, on a first visit,
and then the app opens where you left it — a reveal that repeats is an animation
tax.

### No timeline

One item in 201 carried a date. Every Gantt, calendar and burndown was ruled out
by that number before anything was drawn.

### The spine

When one person accounts for most of the links, the caption says so in words:
*78 of the 109 links are Anthony*. The drawing already shows it, but a sentence
survives being looked away from, and this is the single most useful thing the
whole view has to say.

### Optional, and load-bearing for nothing

No other route reads it, no schema changed, and no write happens from it except
through the ordinary task editor. If it turns out to be a poster rather than a
tool, deleting the route costs three files.


## Three levels, and the one that was fake

The register had three levels from the start — stream, section, item — and the
section level quietly did two jobs at once. "Sponsorship — OrganOx" and
"Sponsorship — collateral" sat at the same level as "Website" and "Hotels and
accommodation", related to each other only by an em dash inside a string.

That is a hierarchy the app cannot read. Nothing could collapse Sponsorship,
count it, navigate to it or say how much of it there was, because as far as the
data was concerned there was no such thing as Sponsorship — only five sections
whose titles happened to start with the same word. Fifteen ISODP sections at one
level is a list wearing a structure's clothes.

### A parent column, not a new table

`sections.parent_id` points at another section. A group is simply a section that
other sections point at, which means no new table, no new query, and no new
concept to learn: the thing you already understand gained one property.

One level deep, deliberately. Two would let the tree grow to the point where
finding something means remembering a path, which is the failure mode of the
document this app replaced.

### Depth is optional

Commonwealth has four sections and no areas. Career has one. A middle level
there would be a heading over a room with one chair in it. So a stream's top
level is a mix of groups and bare sections, and `src/lib/tree.ts` is the single
place that knows how to read that shape — every consumer asks it rather than
re-deriving the rule.

Ordering falls out of it: a group takes the position of its first child rather
than one of its own, so the seed file's order survives grouping unchanged.
Sections that already read well together stay together, and nobody has to
maintain a second ordering.

### Groups are headings, never places

A task cannot be filed into Sponsorship, only into a section inside it. The
pickers offer leaves only, so there is never a question about where something
lives. On the map, a group is not drawn at all — it holds no items, so it would
be an empty dot claiming to be work.

### Renaming was safe; moving would not have been

A seeded row's identity is `<section_id>:<slug(title)>`. Section *ids* did not
change, so dropping "Sponsorship — " from a dozen section titles moved no keys
and orphaned no rows: every completed tick, note and reschedule survived. Moving
tasks between sections would change their keys and churn them, so this change
deliberately did none of that. The bins that remain — a section called "Pipeline
and outreach" holding four things that are really "what I need from Anthony" —
are a separate decision, to be made in the app where rows keep their identity.

### The delete rule has a column list on it

`on delete set null (parent_id)`. The foreign key is composite — `(owner_id,
parent_id)` — and without the column list Postgres nulls every column in the
key, `owner_id` included, so deleting a group fails on a not-null constraint
instead of quietly orphaning its sections. Caught by the RLS proof, which now
asserts both that a section cannot be filed under another owner's group and that
removing a heading leaves the work underneath it in place.
