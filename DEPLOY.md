# Deploying

Everything that can be prepared in advance is done. What is left needs your
Supabase and hosting accounts, so it has to be run by you. It is about fifteen
minutes end to end.

Work through it in order — step 4 depends on step 3, and step 6 depends on
knowing the production URL.

---

# The short way: no terminal, no downloads, no secret key

Everything below happens in a web browser. Nothing is installed, nothing is
cloned, and **the secret key is never needed at all** — the Supabase SQL editor
is already signed in as you, so it needs no credential of its own.

Use this route unless you specifically want to run the app locally.

## 1. Create the project

[supabase.com](https://supabase.com) → New project. Choose **London
(eu-west-2)** — it is a directorate's coordination record and there is no
reason for it to sit outside the UK.

## 2. Create the tables

Left sidebar → **SQL Editor** → New query. Open each of these on GitHub, copy
the whole file, paste, and press Run — **in order**:

1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_rls.sql`
3. `supabase/migrations/0003_realtime.sql`
4. `supabase/migrations/0004_intake.sql`
5. `supabase/migrations/0005_review.sql`

**Migrations go before the code that needs them.** The app auto-deploys from the
default branch, so a new version can be live before its migration has run. It
will not lose anything — a write naming a column the database has not got is
refused, surfaced as a warning, and dropped rather than retried for ever — but
the decision itself does not land. Run the migrations first.

Then run this to confirm the security is really on:

```sql
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r';
```

Every row must say `true` twice. If any does not, run `0002_rls.sql` again.

## 3. Create your account, then shut the door

**Authentication → Users → Add user → Send invitation**, to your own address.

Then **Authentication → Providers → Email → turn "Enable email signups" OFF.**

Both halves matter. The publishable key is readable by anyone who views source
on the deployed site. With signups on, a stranger could create an account inside
your project — they would see none of your data, but they should not get in at
all.

## 4. Load the register

SQL Editor → New query → paste **`supabase/seed.sql`**.

Change one line near the top — the email — to the address you just invited:

```sql
owner_email text := 'you@example.com';
```

Run it. You should see `255 inserted`.

Safe to run again whenever the seed changes. It reconciles rather than
replaces: anything you have ticked, edited, or added yourself is left alone.

## 5. Put the app online

[vercel.com](https://vercel.com) → **Add New → Project** → import
`kealanjones/Commando`.

Under **Environment Variables**, add two:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | your project URL |
| `VITE_SUPABASE_ANON_KEY` | your **publishable** key |

Deploy. Note the URL it gives you.

**Those two, and nothing else.** If the import form offers you any other
variable, delete the row or leave it blank.

## 6. Close the loop

Supabase → **Authentication → URL Configuration** → set **Site URL** to the
Vercel URL. Without this, your sign-in link mails you back to localhost.

## 7. Add it to your phone

Open the URL in Safari → Share → **Add to Home Screen**.

## 8. Intake, if you want it

**One environment variable. Nothing to deploy.**

Reading a meeting runs at `/api/extract`, which ships with the app and deploys
with it. Add one variable in Vercel — the same screen as the other two:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your key from [console.anthropic.com](https://console.anthropic.com) → API Keys |

Then redeploy (Vercel → Deployments → ⋯ → Redeploy) so it picks the value up.

Without it, the Intake screen says so plainly and the rest of the app is
unaffected.

**Read the information governance note in the README first.** This is the step
that sends pasted text outside NHS control.

If you would rather nothing left the app at all, the **Via Claude** tab needs no
key: the app writes a prompt carrying your sections and open items, you run it
in Claude yourself, and paste the reply back into the same triage screen.


## 1. Create the Supabase project

At [supabase.com](https://supabase.com), create a project. Pick **London
(eu-west-2)** as the region: the data is NHS work and there is no reason for it
to sit outside the UK.

From **Project Settings → API**, take three values:

| Dashboard name | Older projects call it | Goes where |
|---|---|---|
| Project URL | — | `VITE_SUPABASE_URL` — hosting env vars and your local `.env` |
| **Publishable** key (`sb_publishable_…`) | `anon` (a long `eyJ…` JWT) | `VITE_SUPABASE_ANON_KEY` — same |
| **Secret** key (`sb_secret_…`) | `service_role` | `SUPABASE_SERVICE_ROLE_KEY` — your local `.env` only |

Supabase renamed these keys; the variable names here still use the older words.
Either key format works — the client handles both. If your dashboard shows a
legacy pair *and* a new pair, use the new ones.

For this route, copy **`.env.seed.example`** — not `.env.example` — to `.env`.
The two files are deliberately separate: hosting providers read `.env.example`
when importing a repo and offer to store everything in it, so the secret key is
kept out of that file entirely.

```bash
cp .env.seed.example .env
```

The `anon` key ships inside the JavaScript bundle. That is expected and safe
**because RLS is enabled and forced on every table**. The `service_role` key
bypasses RLS entirely — it never goes into hosting env vars, never into the
repo, and never gets a `VITE_` prefix.

## 2. Run the migrations

Paste each file into **SQL Editor**, in order, and run it:

1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_rls.sql`
3. `supabase/migrations/0003_realtime.sql`

Or, with the CLI:

```bash
npx supabase link --project-ref <your-ref>
npx supabase db push
```

These three migrations are applied to a throwaway Postgres and their policies
proved on every CI run — see `tests/rls.sql`. Seventeen assertions, including
that a second user sees nothing, that an anonymous caller with the anon key gets
nothing, that sharing one stream grants exactly that stream, and that a hard
delete is refused.

**Confirm RLS is actually on** before going further. In the SQL editor:

```sql
select tablename, rowsecurity, relforcerowsecurity
from pg_tables t
join pg_class c on c.relname = t.tablename
where schemaname = 'public';
```

Every row must show `true` in both columns. If any does not, stop and re-run
`0002_rls.sql`.

## 3. Create your account — and close the door behind you

**Authentication → Users → Add user → Send invitation**, to your own address.

Then **Authentication → Providers → Email**: turn **"Enable email signups" off**.

This matters. The anon key is readable by anyone who views source on the
deployed site. With signups enabled, a stranger could create themselves an
account inside your project. RLS means they would see none of your data, but
they should not be able to get in at all. The app already sends
`shouldCreateUser: false`, so this is the second of two locks.

Under **Authentication → URL Configuration**, set:

- **Site URL** — your production URL (fill in after step 5, then come back)
- **Redirect URLs** — add `http://localhost:5173` for local development

## 4. Seed the register

Locally, with `.env` filled in (or skip all of this and paste
`supabase/seed.sql` into the dashboard instead — no key needed):

```bash
npm run seed:dry    # shows what would change, writes nothing
npm run seed        # apply
```

The dry run prints insert / update / frozen / retire counts. Read them before
applying. Re-running later is safe and non-destructive — see the re-seeding
table in the README.

## 5. Deploy the frontend

Either host works; the config for both is committed.

### Vercel

```bash
npx vercel link
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_ANON_KEY production
npx vercel --prod
```

### Netlify

```bash
npx netlify link
npx netlify env:set VITE_SUPABASE_URL "https://…"
npx netlify env:set VITE_SUPABASE_ANON_KEY "…"
npx netlify deploy --prod
```

`vercel.json` and `netlify.toml` already carry the SPA rewrite, the security
headers, and the cache rules — hashed assets and fonts immutable for a year,
`index.html` and `sw.js` never cached. That last part is not cosmetic: if the
shell is cached, a deploy never reaches a phone that already has the app
installed.

**The build fails deliberately if the two env vars are missing.** A deploy that
silently ships an app which cannot reach its database is worse than a red build.

## 6. Deploy the intake function (optional)

Intake — pasting a meeting record and having it proposed as register items —
runs in a Supabase Edge Function. Skip this and the rest of the app works
normally; the Intake screen just reports that extraction is not configured.

```bash
npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
npx supabase functions deploy extract
```

The Anthropic key lives **only** as a function secret. It must never appear in
the frontend env vars, because those are compiled into the bundle. The Supabase
anon key is safe there because RLS bounds it; an LLM provider key is bounded by
nothing.

Pin the origin allowed to call it. Left unset it accepts any origin, which is
fine locally and not what you want in production:

```bash
npx supabase secrets set ALLOWED_ORIGIN=https://your-production-url
```

The function caps extractions at 40 per account per rolling 24 hours, so a
leaked session cannot run it in a loop and spend against your API key. Change it
with `DAILY_INTAKE_LIMIT` if that is wrong for you.

**Before you turn this on, read the information governance note in the README.**
Pasting a meeting record sends that text to Anthropic's API. That is a decision
about NHS information, not a technical detail, and it is yours to make.

## 7. Close the loop

Back in Supabase → **Authentication → URL Configuration**, set **Site URL** to
the production URL. Without this the magic link mails you back to localhost.

## 8. Add it to your home screen

Open the production URL in Safari on your iPhone → Share → **Add to Home
Screen**. It opens full screen with no browser chrome; the manifest and iOS meta
tags are already in place.

---

## Check it actually works

In order, on the real deployment:

- [ ] Sign in by magic link.
- [ ] All seeded items are present. `select count(*) from tasks where deleted_at is null;`
- [ ] Open it on your phone and your laptop at once. Tick something on one; it
      appears on the other within a second or two.
- [ ] Type a note. The whole sentence lands, not the first character.
- [ ] Complete something, then undo. Delete something, then undo.
- [ ] Turn on aeroplane mode, tick something — the header shows the queued
      count — then turn it off and watch it flush.
- [ ] Try signing in with an address you have not invited. It should be refused.
- [ ] If you deployed intake: paste a short set of notes, check the proposals
      carry a quote you recognise, discard one, and confirm only what you
      accepted reached the register.

### Prove the anon key is harmless

Worth doing once, so you know rather than assume:

```bash
curl -s "https://<ref>.supabase.co/rest/v1/tasks?select=*" \
  -H "apikey: <your-anon-key>"
```

Must return `[]`. That is an unauthenticated request with the key that ships to
every browser — RLS gives it nothing.

---

## Ongoing

- **Backups.** Supabase's free tier keeps daily backups for 7 days; Pro extends
  that. For a directorate's coordination record, consider `pg_dump` on a
  schedule as well.
- **Re-seeding** after editing `data/register.seed.ts` is `npm run seed`, and it
  never destroys your own edits. Details in the README.
- **CI** (`.github/workflows/ci.yml`) typechecks, builds, and runs the browser
  interaction suite on every push. A second job applies the migrations to a real
  Postgres and proves the RLS policies. A third asserts the production build
  still refuses to run without credentials.

## If something goes wrong

| Symptom | Cause |
|---|---|
| "Almost there" setup screen in production | Env vars not set on the host, or set without a redeploy |
| Magic link opens localhost | Site URL not set in Supabase (step 6) |
| Signed in but no data | Seed ran against a different account — check `SEED_OWNER_EMAIL` |
| Changes do not sync between devices | `0003_realtime.sql` not run |
| A deploy does not reach an installed phone app | `index.html` being cached — check the host is honouring the committed cache headers |
| Console: blocked `connect-src` | App built with a different `VITE_SUPABASE_URL` than it is calling; the CSP is generated from that variable at build time |
