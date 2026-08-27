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


## The card, and why it grows

An item used to open as a bottom sheet: a panel that slid up over the list
with no relationship to the thing you touched. It worked, and it told you
nothing. A sheet is a *different* object arriving; the row and its record are
the *same* object at two sizes.

So the row lifts off the page. The card is laid out at its final geometry,
transformed back onto the source rectangle, and released — a FLIP, the same
technique a photo grid uses to open a photo. The row hands its rectangle over
through a module-level handoff rather than a prop, because the open call goes
Today → App → card and threading a DOM node through that would put layout
detail in three components with no other use for it.

### The contents wait for the shape

Nothing inside the card is painted while it is still the size of a row. Text
scaled to a fifth of its size and back is a smear, and a smear reads as a
glitch rather than a transition. The head, title, states, body and footer fade
up in that order, forty milliseconds apart, once the shape has most of the way
there — so the eye follows the object, then reads it.

### The curve had to be slowed down

The first attempt used the app's `--pop` easing, which overshoots and is
almost entirely front-loaded: the card reached full size in about a fifth of
the transition and the growth was invisible. Measuring it frame by frame
showed 100% of the travel done by 110ms of a 460ms animation. The curve is now
`cubic-bezier(.34, .68, .2, 1)`, which passes a third of the way at 76ms and
is still moving at 180ms. The test asserts that shape rather than the timing,
because the test's own clock starts after the click resolves.

### Closing measures the row again

The list may have moved while the card was open — something ticked, a filter
changed, a scroll. So the row is measured again at closing time rather than
trusting the rectangle taken on the way in, and a row that has gone or
scrolled far out of view gives nothing back, at which point the card settles
in place instead of flying to a rectangle that is no longer there.

### The whole row opens it

The dots button was a target you had to aim at. On a phone the natural gesture
is to touch the thing you are reading, so the body of the row is the control
now. That forced one other change: the title no longer ticks the checkbox,
because a tap on a title now means "show me this", and one gesture cannot mean
two things. The checkbox keeps its own target and its own job.

### The card does not steal the caret

Opening focuses the card, not the title. You opened it to read it — a caret in
the title puts a ring round the first thing you look at and throws the
keyboard up on a phone. Every field is still local state seeded once per task,
which is what stops a realtime event re-rendering a textarea mid-sentence.


## Reading dates instead of asking for them

The register opened with one dated item in two hundred, and no amount of
nagging was going to fix that — a screen that says "add a date" to 200 items
is a screen nobody opens twice.

But the dates were largely there already, written into notes and titles
because that is where you write things while you are typing. So the app reads
them back out.

### Every proposal shows its evidence

A date is offered beside the sentence it was taken from, with the matched
words picked out. That is the whole design: the proposal argues for itself and
you can see instantly whether it read you right. A parser that says "9 October
2026" with no working shown is asking to be trusted, and a wrong date is worse
than no date at all.

### Certainty is a sentence, not a score

"87% confident" tells you nothing you can act on. The find carries its own
explanation instead — *a date, spelled out*, *no year given — this is the next
one*, *reading this as the coming Friday — check it is the right one*.

The weekday case earned its hedge the hard way. The first version rated "on
Wednesday" as likely, and the very first thing the real register produced was
"Share Satya's taxi to the hotel on Wednesday morning" resolved to next
Wednesday — when it plainly means the Wednesday of a trip in September. A
weekday names a day and never a week, so it is now never offered as sure.

### What it will not guess at

Eight items promise a deadline in words only: *ahead of the Australia trip*,
*before Sydney*. Those refer to events the app has never heard of. They get
gathered into their own list with a date field and no proposal, because the
alternative is inventing a date and calling it a find.

### The honest count

Reading the real register produced **three** parseable dates, not the eighteen a
first rough grep suggested — that grep matched "mar" inside "marketing" and
"may" as a verb. The sweep is therefore not a one-off fix for a backlog; its
value is that it keeps reading everything that arrives from now on, and meeting
notes are full of "before Friday".

## The brief, and why nothing left the app before

Every feature so far has moved work *inward*: intake, grouping, review, the
map. Nothing ever came back out, and nearly everything this job produces is
something for somebody else — a line for a director before a 1:1, a paragraph
for the monthly report.

### Two different briefs, not one with a filter

A person's brief leads with what you need from them and ends with what has
moved since you last spoke. A stream's leads with what is pressing and ends
with what has gone quiet. Those are different documents for different
conversations; making one template serve both would have produced something
that suited neither.

### Plain text, deliberately

It has to survive being pasted into Teams, Outlook and a Word document, so
there is no markup at all — headings are capitals and lines are bullets. The
formatted version on screen is for reading; the text is for sending, and the
two are generated from the same blocks so they cannot drift.

### Composed locally

No API call. The brief you most want is the one you write on the train, and a
brief that needs a signal is a brief you cannot have when you need it. It also
means nothing about who owes you what leaves the device to produce one.

### An empty block still speaks

"Nothing closed in this window" is information; a silently missing heading is
not. Blocks that matter say so when they are empty, and blocks that do not are
dropped entirely — the difference is set per block rather than guessed at
render time.


## The plan, and the one place colour means quantity

Every other use of colour in this app is structural: a colour tells you which
stream something belongs to and nothing else. The calendar breaks that rule
deliberately, and it is the only thing that does.

A day's colour is its load — green through amber to red — because that is the
one ramp everybody already reads the same way without a key. It is kept well
away from the five stream colours so the two can never be mistaken for each
other, and the legend runs *Clear → Full* underneath in case there is any
doubt.

### The bands are tight at the bottom

One, two and three items are three visibly different days. A scale that only
turned red at fifteen would be technically a heat map and practically a flat
wash, because a real Tuesday has three things on it and not thirty. Five bands
from one item to seven-or-more is what makes the picture say something.

### One item in hand rather than a table of two hundred

The obvious build is a list of undated items with a date picker on each row.
That is a form, and nobody fills in a two-hundred-row form. One item, a month,
and a tap places it — which is a decision every two seconds rather than every
thirty. The queue is ordered so the flagged items come first, then the ones
with most queued behind them in the same section: dating the thing eleven
others are stacked behind is worth more than dating a one-off.

### No toasts

Placing thirty items in one sitting would stack thirty toasts. What was just
placed is named under the item in hand instead, with an Undo beside it, and the
day it landed on opens automatically — the consequence of the decision is the
thing you most want to see straight after making it.

### Place and Look

Tapping a day places the item in hand on it, which is right nineteen times in
twenty. Inspecting a day was originally right-click only, which does not exist
on a phone, so there is an explicit two-state control instead. It disables
Place when the queue is empty rather than pretending there is a choice.

### Narrowing the queue, not the calendar

Limiting to one stream filters what you are placing but leaves the month
showing everything. Planning Commonwealth against a calendar that only knew
about Commonwealth would hide the ISODP work already on that Thursday, which is
exactly the collision the screen exists to prevent.

## One stream on its own

The Web's stream keys already dimmed the other streams, which answers "how far
does this reach outside itself" — the caption even counts it. It does not
answer "let me just look at this", because fifteen lit dots in a field of
eighteen ghosts is still a picture of thirty-three things.

So soloing rebuilds the graph from that stream's sections alone. The layout
re-flows, the link count is recomputed, and the connector list becomes the
people who hold *that stream* together rather than the register. Anthony is in
fourteen sections overall and five inside ISODP, and both numbers are true
about different questions.

Two details that stop it becoming a trap: the other stream keys keep counting
the whole register, so they remain a way back rather than a row of zeroes; and
letting go of the stream lets go of the solo with it, so there is no state you
can get into where the picture is narrow and nothing on screen says why.


## Two answers that are not a date

A dating queue asks one question — *when?* — and for a fair number of items
that is the wrong question. Some are already finished and were never ticked;
a few should never have been on the list at all. Without somewhere to say so,
both get a date they do not deserve, or get passed over every sitting for
ever, and the queue never actually empties.

So **Already done** and **Delete** sit next to the day chips on the item in
hand, and quietly under each row of the date sweep. Both are reversible from
the same line the placement uses, because a decision made at two seconds an
item is a decision made quickly, and everything made quickly needs taking
back easily.

Done is tinted green rather than warned about in red: finishing something is a
good outcome, and the only destructive control on the screen should look like
the only destructive control on the screen. The delete is the app's ordinary
soft delete, so it is recoverable long after the undo line has gone.
