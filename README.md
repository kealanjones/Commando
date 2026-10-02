# Work Register

A personal register for five parallel workstreams. It answers one question
first — **what must I do today?** — and keeps everything else broken down,
in its place, until you go and look.

---

## Four tabs

| | |
|---|---|
| **Today** | What is overdue, what is due today, and what you flagged urgent. One list, three headings, and a count beside the title. Nothing else. |
| **Projects** | Every project on one line — how much is open, what is overdue, when you last touched it. Open one and it is broken down by sub-focus. **Organise** adds, renames, reorders, moves, merges and deletes projects and sub-focuses. |
| **People** | Who owes you what. Open a person before a catch-up: everything that names them, a **Brief** to paste, and **Go through them** one at a time. |
| **Review** | The weekly review — a short deck of things that have gone stale, one decision each — and **Plan**, for giving undated items a day against a calendar of how busy each day already is. |

## The look: Ledger Desk

A ruled page: square corners, a black rule between panes and under a
heading, a hairline between rows, a double rule under a total, and the date
of each item in the left margin like a diary. Projects are short codes rather
than colours; red means overdue and nothing else.

**At a desk** (1100px and wider) the register is three panes: the **index**
on the left (the date, which life, the four places with what is in them,
every stream), the **list** in the middle, and the **folio** on the right,
where the selected item opens. Edits in the folio land as you make them —
toggles and dates at once, the title and note when you leave the field.
The list can be driven from the keyboard:

| | |
|---|---|
| `J` `K` | Move down and up the list |
| `↵` | Edit the title |
| `X` | Done (with Undo) |
| `U` | Urgent on or off |
| `D` | Give it a date |
| `N` | New item |
| `/` or `Cmd/Ctrl+K` | Search |
| `Esc` | Put the folio down |

**Motion** is quiet and always going somewhere. Pages arrive rather than
appear; the selection glides from row to row; ticking fills the box with
ink, springs the tick out and draws a line through the title, and once the
undo has run out (a line on the toast drains to show how long is left) the
row folds shut. Counts roll the way they went, switches underline with a
line that grows, anything pressed gives a little and springs back, and a
change of paper or light cross-fades the page. All of it stops for
reduced motion.

**On a phone** it is one column: the date and which life at the top, and at
the bottom a full-width **Add an item** — adding is the main job there — over
the four tabs. An item opens as a card that grows out of its row.

**Settings** holds the paper and the light. **Ledger** is white and black.
**Notebook** is a notepad kept by hand: ruled paper with a little grain, a
handwritten face (Kalam), every row a whole number of lines so writing sits
on the rules, a double red margin with the dates written in it, punched holes
down the binding (across the top on a phone), a highlighter that swipes
across the line you are on, a pen stroke through what is done, the open item
as an index card taped beside the page, and toasts as sticky notes. Either can **follow the device** into dark, or be fixed light or dark.
All of it is kept on the device; none of it is written to the register.

Meetings come in from **Meeting**, next to New item at a desk, or **Add → Paste meeting notes instead**. Paste notes or a transcript: a **Notes / Transcript** switch (guessed from what you paste) tells the reader which it is, since notes are read line by line and a transcript for what people agreed to do.

## One kind of item

Everything in the register is an item in a section. An item is open or done.
It can have a **date**, and it can be flagged **urgent**. That is the whole
model — and it is what decides Today:

- a date in the past → **Overdue**
- today's date → **Today**
- flagged urgent → **Urgent** (the first five show; the rest fold behind *more urgent*)

Nothing reaches Today any other way, so Today can always explain itself, and
the way to change it is to change the item.

Earlier versions had a second kind of thing ("watch" items with no checkbox)
and a third state ("not clear yet"). Migration `0009_one_kind.sql` folds both
back into ordinary items; nothing is deleted.

A ticked item stays where it was, struck through, as a record of what got
done. **Clear done** (next to the count, and on a stream or a person) takes
the struck ones off the page; they are still under a stream's **Done**.

Under the date, each tick draws a tally mark. Press them for today's receipt:
everything you finished, when, and a total, ready to copy. Pass 5, 10, 15, 20
or 30 in a day and a stamp comes down on the page. It all resets each morning.

### Work and personal

The switch in the header decides which life the register is. It is applied
inside the queries, so in **Work** the personal streams are not dimmed — they
are simply not there, on every screen and in search. The choice survives a
reload. Career sits with Personal.

### The review

A register that only grows is the problem it was built to solve. The weekly
review offers up to eight items, one at a time, worst first: overdue, then
*no finish line* ("keep the pipeline current"), then urgent but undated, then
anything untouched for three weeks. Each gets one decision — **give it a date**,
**done**, **drop it**, or **leave it** — and every decision can be undone. A
decided item is left alone for a month.

### Memory

Every meeting read in also feeds a **memory** of the work: a note per project,
per person and per recurring topic, each with where things stand **now** and a
dated **timeline**. Each meeting adds a few lines and refreshes the "now" of the
notes it touched, so the memory grows with every meeting without ever being
rewritten wholesale. Every line keeps the meeting it came from.

- **The reader uses it.** Each new meeting is read with what the memory already
  knows, so it files things better and understands shorthand.
- **Ask it** on the Memory page ("What did we agree with OrganOx?"): answers come
  from the memory and the open register, and name the meetings they rest on.
- **Browse and correct it:** fix a "now", strike a wrong line.
- **Export for Claude:** one Markdown file of the whole memory, to add to a
  Claude Project so everyday chats know the work too.
- **Forget a meeting** takes out exactly what it added; **Erase memory** takes
  out everything (the meetings stay, and can be remembered again).

It runs through `/api/memory` with the same `ANTHROPIC_API_KEY` as Intake. On the
Via Claude route the record never reaches the app, so Claude's reply includes a
`memory` part and that is what is remembered.

**Information governance.** The memory is a concentrated, searchable record of
conversations, names and decisions. It is personal under RLS, like intake, but
check with NHSBT information governance that keeping it is acceptable before
relying on it for sensitive work.

### Intake

Paste notes, a transcript or an email chain and get back proposed items, each
routed into one of your sections and carrying **the quote it came from**.
Nothing is written until you accept it; an item that fits no section comes back
unplaced rather than guessed; a proposal that restates an open item is flagged.

Two ways in: **Read it here** (runs at `/api/extract`, needs `ANTHROPIC_API_KEY`
on the Vercel project) or **Via Claude** (copy a prompt, paste the reply back —
no key, nothing sent by the app).

---

## Running it

```bash
npm install
cp .env.example .env      # your Supabase URL and publishable key
npm run dev
```

### Seeing it without a backend

```bash
npm run build:demo && npm run serve:dist   # or: VITE_DEMO=1 npm run dev
```

Fixture mode renders the whole app from `data/register.seed.ts` with no
Supabase connection and no sign-in. Writes stay in memory and are discarded on
reload.

### Tests

Unit suites run directly; browser suites need the demo build being served
(`npm run build:demo && npm run serve:dist`). CI runs all of them.

| | |
|---|---|
| `npm run typecheck` | TypeScript, no emit |
| `npm run test:today` | What Today shows, and what it counts |
| `npm run test:tree` | Stream → area → section: the shape and the order it reads in |
| `npm run test:plan` | The month grid, the load bands, the queue that needs dating |
| `npm run test:brief` | What goes in a brief and what it reads like |
| `npm run test:search` | Search ranking and highlighting |
| `npm run test:parse` | The paste parser against the shapes people actually paste |
| `npm run test:api` | The `/api/extract` guards: auth, method, missing key |
| `npm run test:dberror` | That a failed write explains itself |
| `npm run test:ui` | Notes, ticking, undo, delete, keyboard, reduced motion |
| `npm run test:modes` | Work and personal; Today's count; the desk and its keys; paper and light |
| `npm run test:card` | The item card on narrower screens: growing out of a row and back into it |
| `npm run test:review` | The Review tab, the deck, and a person's page |
| `npm run test:planning` | Placing work on days in the browser |
| `npm run test:brief-ui` | The brief, from a person and from a stream |
| `npm run test:intake` | Paste → triage → commit |
| `npm run test:paste` | Copy prompt → paste reply → triage |
| `npm run test:find` | Search in the browser |
| `npm run test:groups` | Areas in the browser: reading, filing, finding |
| `./tests/rls.sh` | Migrations on a real Postgres: the RLS proof, and 0009 on old data |
| `npm run test:shots` | Screenshot the main routes at 375px and 1280px |

Screenshots from the browser suites go to `SHOTS_DIR`, or a folder in the
system temp directory.

### Other scripts

| | |
|---|---|
| `npm run seed` | Seed or re-seed the database |
| `npm run seed:dry` | Report what a seed would change, write nothing |
| `npm run seed:sql` | Regenerate `supabase/seed.sql` for pasting into the dashboard |
| `npm run build:preview` | Fold fixture mode into one self-contained `preview.html` |

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
| `0004`–`0007` | Intake, review, threads, section groups |
| `0008_realm.sql` | Work or personal, on each stream |
| `0009_one_kind.sql` | One kind of item: watch items become ordinary items, parked items go back into play |
| `0010_cleared.sql` | Done items stay on the page, struck through, until **Clear done** |
| `0011_two_levels.sql` | Two levels: projects and sub-focuses. Grouped sections fold into their group; items keep the old name as a tag |
| `0012_memory.sql` | Memory: living notes per project, person and topic, built from every meeting |

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
reschedules and `touched_at`.

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

### Adding to the seed

Put items in a section's `items` array, then re-seed. A section's `watch` array
is still read, for older seed files, but its entries land as ordinary items
after the rest — there is only one kind of item now.

```ts
{
  id: 'isodp-accred',
  stream: 'isodp',
  title: 'Accreditation',
  items: [
    P('Confirm CME accreditation route', { p: 1 }),   // p: 1 → urgent
    'Check timelines against the programme',
  ],
},
```

How the original list was mapped is in [`docs/DATA-MAPPING.md`](docs/DATA-MAPPING.md).

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
- `prefers-reduced-motion` collapses all animation.
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
src/routes/               Today, Streams (projects), Organise, People, Person, Review, Plan, Brief, Intake, Settings, sign-in
src/components/           the index and phone bars, rows, the folio, the card, sheets, search, toasts
src/data/store.ts         queries, optimistic mutations, derived signals
src/data/review.ts        the review queue and the decision mutations
src/data/intake.ts        extraction call and triage state
src/lib/today.ts          what Today shows: overdue, today, urgent
src/lib/tree.ts           stream → area → section, the one place that knows the shape
src/lib/plan.ts           the month, the load bands and the queue that needs dating
src/lib/brief.ts          composing something the register can hand back
src/lib/search.ts         ranking and highlighting
src/lib/modes.ts          which life, which paper, which light
src/lib/selection.ts      where an item opens: the folio at a desk, the card on a phone
src/lib/queue.ts          the offline write queue
api/extract.ts            reads a meeting server-side; holds the Anthropic key
src/styles/tokens.css     the two papers, light and dark: every colour and face
DEPLOY.md                 the deployment runbook
tests/                    unit and browser checks, plus the RLS proof (rls.sql)
docs/DECISIONS.md         why it works the way it does
```
