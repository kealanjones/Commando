# Work Register

A personal register for coordinating five parallel workstreams. It answers two
questions, in this order:

1. **What must I do today?**
2. **Which of my workstreams is quietly falling behind?**

The second question is the one a flat list never answers, and it is what most of
the design is for.

---

## The shape of it

| | |
|---|---|
| **Today** | Five stream cards, one nudge, and three tasks. Nothing else. |
| **Streams** | Everything, stream → area → section, with filters including who you are waiting on. |
| **Web** | The same register as a shape: what is connected to what, and what has gone quiet. |
| **People** | Who owes you what. Open one before a catch-up. |
| **Periphery** | The remembering register. Nothing here can be ticked. |
| **Intake** | Paste a meeting record; review what it proposes; accept what is real. |

### The recency dial

Each stream is a card carrying its own colour, with a dark badge showing its open
count and **a ring around that badge showing recency** — full when the stream was
touched today, emptying as it goes quiet, against a 21-day scale.

It measures time since last contact, not completion. That is deliberate: a
congress has no denominator, so any percentage-done figure would be fiction.
Staleness is computed from `touched_at` and never entered by hand.

### Three levels, and only where they are earned

**Stream → area → section → item.** ISODP is a stream; Sponsorship is an area
inside it; OrganOx is a section inside that; chasing their UK marketing manager
is an item.

The middle level is real data, not a naming convention. It used to be spelled
out in the section's own title — *Sponsorship — OrganOx*, *Finance — sponsor
payment process* — which meant nothing could collapse by it, count by it or
navigate by it, because nothing could read it. Fifteen ISODP sections at one
level is a list wearing a structure's clothes.

Now ISODP reads as five things (Sponsorship, Finance, Programme, Delegates and
logistics, Website) and the Directorate as seven, and each area says how much is
in it and how far it spreads before you open it.

**Depth is optional, and that is the point.** Commonwealth has four sections and
no areas at all; Career has one. Forcing every section into a group would be
filing for its own sake — a heading over a room with one chair in it. A stream
small enough to read at a glance is left flat.

Areas are headings, never places: a task cannot be filed *into* Sponsorship, only
into a section within it, so there is no ambiguity about where anything lives.
Delete an area and its sections stay, one level up.

### Threads — the strands the sections miss

Sections are a filing system: one item, one place. Work does not arrive that
way. Satya's trip lives in Commonwealth *and* in Directorate; sponsorship runs
across five ISODP sections. A **thread** is an overlay, not a move — an item
keeps where it is filed and gains a strand.

The app proposes them. Each suggestion arrives named, listing exactly what it
would gather, everything pre-selected and each item showing where it is filed.
**You take out whatever does not belong before agreeing**, rename it if the
suggested name is wrong, and nothing is grouped until you say so. *Not a thread*
turns it down for good.

Suggestions are computed locally from the words already in the register — no
API, no key, works with no signal, and instant on 255 items. Which also means a
proposal can always explain itself: *these ten share this word, across five
sections*.

Two rules make the suggestions worth reading:

- **A strand inside one section is never offered.** Your filing already tells
  you that. Only a thread that crosses sections adds anything.
- **Only two kinds of word can name a thread**: a proper noun (Dale, Getinge,
  QEII, VAT) or a word from your own section titles (sponsorship, accreditation,
  hotels). Scoring by how many sections a word reaches sounds right and is
  exactly backwards — a generic word like *through* or *whether* appears
  everywhere, so it spans the most sections and wins. Restricting the vocabulary
  makes a bad suggestion structurally impossible rather than merely unlikely.

### The web — the register as a shape

Optional, and nothing else depends on it. Two questions a list is bad at.

**What is actually connected to what.** A dot is a section, not a task — 255
dots is a hairball, and you do not think in tasks anyway, you think in "the
Australia business". A line between two dots means they move together: **dashed**
because the same person is named in both, **solid** because you put them in the
same thread. Names are observed, threads you asserted, so a thread counts double
in the pull between two sections.

The point is what the filing hides. Australia and Sydney is filed under
Commonwealth; released, it settles beside Office and OrganOx, because Satya and
Dale are in all three. And when one person holds most of the web together, the
caption says so outright — *78 of the 109 links are Anthony* is not something the
list will ever tell you.

**What has gone quiet.** Every dot fades toward white as the days since you last
touched that section pile up — full colour today, empty at three weeks. Neglect
becomes something you see rather than something you audit. A register with no
history at all opens at full colour rather than looking abandoned.

Three arrangements of the same dots:

| | |
|---|---|
| **As filed** | Five piles, the way you keep them |
| **As connected** | Released: shared people and threads pull sections together |
| **Under pressure** | A scatter — quiet across, loaded up. The top right is the corner going quiet with work still in it |

Everything else on a dot carries a reading too: **size** is open items plus what
you are keeping tabs on, **the arc on the ring** is how much of that section is
finished, **a red dot** is work that is pressing, and **a dashed ring** is a
section you only monitor.

Pick a connector or a thread to see just their reach; pick a stream to see how
much of it leaks outside itself. Drag a dot to park it, double-click to let it
go. Selecting a section lists its open work, and tapping an item opens the same
editor as everywhere else — the map is a way into the register, not a poster of
it. Arrow keys walk between sections without a mouse; `Escape` clears.

The first visit holds the filed arrangement for a beat and then lets go, because
watching Australia leave the Commonwealth pile is the whole argument and it only
needs making once. After that it opens where you left it.

### Finding things

The magnifying glass in the header, `/`, or `Cmd/Ctrl+K`. It searches task
titles, your notes, the detail carried over from the seed, section names and
who you are waiting on — all at once, over the already-cached list, so it works
with no signal and returns as you type.

Ranked rather than filtered: with 255 items a plain substring match buries the
thing you meant under everything that merely mentions the word. An exact title
beats a prefix, which beats a word-boundary match, which beats one buried
mid-word — so "organ" finds *Organ Recovery Systems* before *reorganisation*.
Notes and section names count for less than titles; finished items are found but
demoted. Every word you type has to appear somewhere, so a second word narrows
rather than widens.

Arrow keys move, Enter opens the item, Escape closes. Matches are highlighted,
and when the hit was in a note or in the seeded detail, that line is shown
underneath rather than leaving you guessing why the result is there.

### The review — what stops the list eating itself

A register that only grows is the problem it was built to solve. Intake adds
items after every meeting; nothing removed any. Worse, **a fifth of the tasks
began with a verb that has no finish line** — "keep the pipeline current",
"continue seeking sponsors". There is no state of the world in which those get
ticked, so they would sit in the do-column for ever, diluting everything that
can actually be finished.

So the app asks. When decisions are waiting, Today offers a short deck — eight
cards, one at a time, a few seconds each:

> **No finish line.** There is no state of the world where you tick this. It is
> a standing concern, not a task.
> **Keep the sponsor pipeline current**
> *Give it a date · Just watch it · Not clear yet · Drop it*

Cards are queued by reason, worst first: overdue, then no-finish-line, then
urgent-but-undated, then anything untouched for three weeks. A decision snoozes
the item for a month — without that the same cards return every week and the
ritual dies. Every decision is reversible, and the deck ends by telling you what
changed: *your do-column is 8 lighter*.

**Not clear yet** is the third answer to "is this doing or remembering". Some
things are neither: real work you cannot act on because you do not yet know what
it means. Parking one takes it off Today and puts it in its own pile to work
through later, which is honest in a way that either forcing it into the task
list or demoting it to the periphery is not.

The same card surface runs for a person: open **Anthony** before a 1:1 and go
through the seventeen things he owes you, one at a time, with *I've chased them*
in place of *give it a date*.

### Intake

Paste notes, a transcript or an email chain. It comes back as a list of proposed
items, each routed into one of your real sections, each carrying **the verbatim
quote it came from** so a proposal can be checked in two seconds rather than by
re-reading the transcript.

Three things it deliberately does not do:

- **It does not write to the register.** Proposals land in `intake_items` and
  stay there until you accept them. An LLM reading a transcript is a good first
  pass and a bad final authority.
- **It does not invent placement.** If nothing fits, the item comes back
  unplaced and is excluded from the ready count until you choose a section.
  A guess routed into the wrong stream is worse than an obvious gap.
- **It leans towards watching, not doing.** The prompt says so explicitly: a
  false task nags every morning, a false watch item is merely quiet. That
  asymmetry is the whole point of the register, so extraction inherits it.

It also checks proposals against your existing open items and flags anything
that restates one, because half of what comes out of a meeting is already on
the list.

Two ways in.

**Via Claude.** Needs nothing at all. The app writes a prompt that already carries your streams, your
sections and every item you have open. Copy it, paste it into Claude with the
meeting underneath, paste the reply back. No API key, no function to deploy, and
nothing new leaves — you are already in Claude when you do it, which makes it a
decision each time rather than a pipe that is always open. The parser takes the
fenced block, the whole reply, or a bare array, and says plainly what to do when
it cannot read something.

**Read it here.** The default. Paste the record and it is read for you. Runs at
`/api/extract`, which ships and deploys with the app — the only setup is adding
`ANTHROPIC_API_KEY` to the Vercel project. The key never reaches the browser;
the endpoint forwards your own session to PostgREST, so its reads and writes are
bounded by the same RLS policies the app runs under.

Same triage screen either way.

### Doing versus remembering

About a quarter of the register is not work — it is things that must stay in
peripheral vision without demanding anything today. Those are `kind = 'watch'`,
they live on their own screen, they never appear on Today, and **they have no
checkbox anywhere in the interface**. A checkbox is a demand. *Make a task* is
the only way out, and the conversion is the one animation in the app allowed to
be noticeable.

Full design and architecture reasoning is in [`docs/DECISIONS.md`](docs/DECISIONS.md).

---

## Running it

```bash
npm install
cp .env.example .env      # your Supabase URL and publishable key
npm run dev
```

### Seeing it without a backend

```bash
VITE_DEMO=1 npm run dev   # or: npm run build:demo
```

Fixture mode renders the whole app from `data/register.seed.ts` with no Supabase
connection and no sign-in. Writes stay in memory and are discarded on reload.
Useful for looking at layout against the real volume of items.

### A shareable single file

```bash
npm run build:preview
```

Builds fixture mode into one self-contained `preview.html` — every script and
stylesheet inlined, no service worker, hash routing so it works with no server.
Open it directly or send it to someone. It carries the real register content, so
treat it as you would any other document with your work in it.

> Seeding from your machine additionally needs the secret key — copy
> `.env.seed.example` instead. You can avoid that entirely by pasting
> `supabase/seed.sql` into the Supabase dashboard; see DEPLOY.md.

### Scripts

| | |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run seed` | Seed or re-seed the database |
| `npm run seed:sql` | Regenerate `supabase/seed.sql` for pasting into the dashboard |
| `npm run seed:dry` | Report what a seed would change, write nothing |
| `npm run build:demo` + `npm run serve:dist` | Build and serve fixture mode |
| `npm run test:ui` | Browser interaction checks (needs `serve:dist` running) |
| `npm run test:intake` | End-to-end paste → triage → commit checks |
| `npm run test:review` | The review deck, the people view and the unclear pile |
| `npm run test:paste` | Copy prompt → paste reply → triage, end to end |
| `npm run test:parse` | The paste parser against the shapes people actually paste |
| `npm run test:api` | The `/api/extract` guards: auth, method, missing key |
| `npm run test:search` | Search ranking and highlighting |
| `npm run test:group` | What can and cannot anchor a thread |
| `npm run test:tree` | Stream → area → section: the shape and the order it reads in |
| `npm run test:groups` | The middle level in the browser: reading it, filing into it, finding through it |
| `npm run test:dberror` | That a failed write explains itself rather than going quiet |
| `npm run test:threads` | Proposing, editing, accepting and dismissing a grouping |
| `npm run test:find` | Search in the browser: shortcuts, keyboard, opening a result |
| `npm run test:graph` | The web's graph and its three layouts, with no browser |
| `npm run test:web` | The web in the browser: arrangements, filters, selection, keyboard |
| `./tests/rls.sh` | Apply the migrations to a local Postgres and prove the RLS policies |
| `npm run test:shots` | Screenshot every route at 375px and 1280px |
| `npm run build:preview` | Fold the app into one self-contained `preview.html` for sharing |

---

## Deploying

See **[DEPLOY.md](DEPLOY.md)**. There are two routes:

- **In the browser only** — no terminal, no clone, and the secret key is never
  needed. Migrations and `supabase/seed.sql` are pasted into the Supabase SQL
  editor, the app is deployed from Vercel's web interface. Use this unless you
  want to develop the app.
- **Locally** — the usual `.env` and `npm run seed` route, for development.

## Supabase setup

### 1. Create the project

Create a project at [supabase.com](https://supabase.com). From
**Project Settings → API** copy the project URL and the `anon` key into `.env`,
and the `service_role` key into `SUPABASE_SERVICE_ROLE_KEY`.

The **publishable** key (called `anon` on older projects) ships to the browser.
That is safe **only** because RLS is enabled and forced on every table — see
below. The **secret** key (`service_role` on older projects) bypasses RLS and
stays on your machine. The service role key bypasses RLS entirely: it
belongs in `.env` and CI secrets, never in the repo and never prefixed `VITE_`.

### 2. Run the migrations

Either paste each file into the SQL editor in order, or use the CLI:

```bash
supabase link --project-ref <your-ref>
supabase db push
```

| | |
|---|---|
| `0001_schema.sql` | Tables, indexes, the `stream_health` view |
| `0002_rls.sql` | Row Level Security |
| `0003_realtime.sql` | Realtime publication |

### 3. Sign in once

Invite yourself from **Authentication → Users → Add user**, then turn **email
signups off** under Authentication → Providers → Email.

The app signs in with `shouldCreateUser: false`, so only invited addresses can
ever get in. This matters because the anon key is readable in the shipped
bundle — RLS would keep a stranger's account empty, but there is no reason to
let them create one.

In **Authentication → URL Configuration**, set the Site URL to your production
URL and add `http://localhost:5173` to the redirect allow-list.

### 4. Seed

```bash
SEED_OWNER_EMAIL=you@example.com npm run seed
```

---

A pre-deployment security review is in
[`docs/SECURITY-REVIEW.md`](docs/SECURITY-REVIEW.md), covering what was checked,
what was fixed, and what is accepted and why.

## Information governance

**Intake's *Read it here* route sends the text you paste to Anthropic's API.**
Everything else in this app stays between your browser and your Supabase
project — including the *Via Claude* route, which sends nothing anywhere: you
paste into Claude yourself, and only the proposals and their quotes come back.

That is a decision about NHS information, not a technical detail, so it is made
deliberately and it is reversible:

- Intake is **opt-in per deployment**. Without `ANTHROPIC_API_KEY` set as a
  function secret, the feature reports that it is not configured and the rest of
  the app is unaffected. Not deploying the function at all removes it entirely.
- Nothing is sent in the background. Text leaves only when you press **Read it**,
  and the screen says so before you do.
- The pasted text is stored against your account in `intakes` so each item can
  show where it came from. It is subject to the same RLS as everything else,
  and — unlike a task — it is **never** visible to someone you share a stream
  with, because a meeting record routinely covers more than the one workstream
  they were given.
- The Anthropic key exists only as a Supabase function secret. It is never in
  the repo and never in the frontend bundle.

Whether that trade is acceptable for a given meeting is your call, meeting by
meeting. The app makes it visible rather than making it for you.

## Security

RLS is **enabled and forced** on all seven tables. Forced matters: it applies
policies to the table owner too, so a mistake in a `security definer` function
cannot quietly read everything.

None of that is asserted on trust. `./tests/rls.sh` applies the migrations to a
real Postgres and runs seventeen checks — a second user sees nothing, an
anonymous caller holding the anon key gets nothing, sharing one stream grants
exactly that stream and no more, a hard delete is refused, and every table
reports RLS both enabled and forced. It runs in CI on every push.

Access is granted through two helpers, `can_read_stream` and `can_write_stream`,
which resolve to *you own it* **or** *someone shared that stream with you*.
Nothing is granted to `anon`.

There is deliberately **no DELETE policy on `tasks`**. The app cannot hard-delete
a row at all. Deletion sets `deleted_at`, which is what makes undo work and what
stops a fat-fingered tap on a phone losing anything. Purging is an admin
operation with the service role.

### Sharing a stream later

Single user today, modelled for two. To give your EA edit access to one stream,
insert one row:

```sql
insert into stream_members (owner_id, stream_id, member_id, role)
values ('<your-uuid>', 'isodp', '<their-uuid>', 'editor');
```

They then see that stream and nothing else. No migration, no schema change.

---

## Re-seeding

`data/register.seed.ts` is the source of truth for seeded content. Edit it and
run `npm run seed` as often as you like — **it reconciles, it does not replace.**

Every seeded item has a stable natural key of `<section_id>:<slug(title)>`, so a
re-run matches existing rows instead of duplicating them.

What happens on a re-run:

| In the seed file | In the database | Result |
|---|---|---|
| New item | — | Inserted |
| Changed wording or flag | Untouched by you | Updated |
| Changed wording or flag | You edited it | **Left alone** |
| Removed | Untouched, not done | Soft-deleted, recoverable |
| Removed | Done, or edited by you | **Left alone** |
| — | You created it in the app | **Never touched** |

Always survives a re-seed: done state, your notes, due dates you set,
reschedules, promotions between task and periphery, and `touched_at`.

Run `npm run seed:dry` first to see the counts before anything is written.

### Two columns for notes

- **`context`** — supplied by the seed file, replaced on every re-seed.
- **`note`** — written by you, never touched by the seed.

This is what lets the seed file keep ownership of the wording of "9 October,
1–2pm. Agenda to follow." while your own note on the same task is safe forever.

### Renaming a seeded item

The natural key derives from the title, so changing a title in the seed file
reads as *old item gone, new item arrived*: the old row is soft-deleted and a new
one inserted. If you want to keep its history, rename it in the app instead — that
sets `user_edited` and freezes the seed out of that row.

### What is in the register

**255 items across 33 sections** — 201 tasks and 54 watch items — built from the
Master Work Action List. 24 flagged *do now*; exactly one carries a date.

How the list was mapped, and the judgement calls made along the way, are in
[`docs/DATA-MAPPING.md`](docs/DATA-MAPPING.md).

To add more: put tasks in a section's `items` array and anything that only needs
remembering in its `watch` array, then re-seed.

```ts
{
  id: 'isodp-accred',
  stream: 'isodp',
  title: 'Accreditation',
  items: [
    P('Confirm CME accreditation route', { p: 1 }),
    'Check timelines against the programme',
  ],
  watch: [
    'Whether the accreditation body changes its rules before 2027',
  ],
},
```

---

## Offline

The app is expected to be used on the Underground.

- The shell — including the fonts, which are self-hosted rather than pulled
  from a CDN — is precached by a service worker, so it opens with no signal.
- Reads come from the TanStack Query cache (`networkMode: 'offlineFirst'`).
- Every write is applied to the cache immediately and appended to a durable
  queue in `localStorage`, which flushes on reconnect, on tab focus, and on
  the `online` event.
- A write that fails for a reason a retry cannot fix surfaces as a warning
  toast naming the error. **Nothing is dropped silently** — that is the one
  thing the queue exists to prevent.

A pending or offline state shows as a badge in the header.

### Getting new versions

The app deploys on every push and the service worker keeps the shell cached, so
a tab left open — or an installed home-screen app, which stays open for days —
would otherwise carry on running whatever it started with.

When a new version lands you get a toast offering **Reload**. It is offered
rather than forced: a refresh in the middle of a sentence would lose a note
being typed, which is the one thing this app must not do. An install also checks
for updates hourly, so a long-lived one does not only notice on a cold start.

### Add to Home Screen

The manifest sets `display: standalone` and the iOS meta tags are in place, so
adding it to your home screen opens it full screen with no browser chrome. Safe
areas are respected, and the fixed bottom navigation never covers the last item
in a list.

---

## Realtime

Enabled on `tasks` and `sections`. A change on your phone invalidates the query
on your laptop within a second or so. Realtime respects RLS, so a subscriber only
receives rows they could have selected anyway.

It earned its place because the app is genuinely open in two places at once. It
is a handful of lines in `useRealtime()` and can be removed by deleting
`0003_realtime.sql` and that hook.

---

## Accessibility

Checked in a real browser by `npm run test:ui`:

- Keyboard reachable throughout, with a visible 3px focus ring on every control.
- Icon-only buttons carry `aria-label`; checkboxes name the task they complete.
- `prefers-reduced-motion` collapses all animation, including the promote
  ceremony, which falls back to an instant state change.
- Nothing overflows horizontally at 375px.
- The fixed navigation never covers the last item in a list.
- A skip link, and `aria-live` on the toast region.

---

## Project layout

```
data/register.seed.ts     the seed source of truth — edit this
data/people.ts            names extracted into the waiting-on dimension
supabase/migrations/      schema, RLS, realtime
scripts/seed.ts           idempotent reconciling seeder
src/lib/                  supabase client, offline queue, types, slug
src/data/store.ts         queries, optimistic mutations, derived signals
src/components/           dial, cards, sheets, toasts
src/routes/               Today, Streams, Web, People, Periphery, Intake, Review, sign-in
src/data/review.ts        queue building and the decision mutations
src/lib/search.ts         ranking and highlighting
src/lib/grouping.ts       finding the strands the sections miss
src/lib/tree.ts           stream → area → section, the one place that knows the shape
src/lib/web.ts            the register as a graph: links, connectors, staleness
src/lib/force.ts          the three layouts, framework-free and testable
src/lib/webPaint.ts       drawing the web on a canvas
src/data/intake.ts        extraction call and triage state
api/extract.ts            reads a meeting server-side; holds the Anthropic key
src/styles/tokens.css     the design system: colour, type, radii, motion
src/styles/fonts.css      self-hosted @font-face (scripts/fetch-fonts.sh)
vercel.json netlify.toml  SPA rewrites, security headers, cache policy
DEPLOY.md                 the deployment runbook
tests/                    browser checks, plus the RLS proof (rls.sql)
docs/DECISIONS.md         why it looks and works the way it does
docs/DATA-GAP.md          what is missing from the seed data
```
