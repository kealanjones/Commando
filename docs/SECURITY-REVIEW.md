# Security review

Carried out before deployment, on the whole codebase — there is no base branch
to diff against, so this covers everything rather than a changeset.

## Verified clean

| Check | Method | Result |
|---|---|---|
| Secrets in the repo | `git ls-files` grep for key patterns | None. Only `.env.example` placeholders; the one match is the string `service_role` as a Postgres role name in the test shim. |
| Secrets in the shipped bundle | Production build, grep for key names | None. The Anthropic key exists only as a Supabase function secret. |
| XSS sinks | grep for `dangerouslySetInnerHTML`, `innerHTML`, `eval` | None. All rendering goes through React's escaping. |
| RLS | `tests/rls.sh`, 21 assertions against real Postgres | A second user sees nothing; an anonymous caller holding the anon key gets nothing; sharing one stream grants exactly that stream; hard delete is refused; every table has RLS enabled **and** forced. |
| Transcript privacy | RLS assertion | `intakes` and `intake_items` are owner-only with no share path. A stream collaborator cannot read the meeting record an item came from. |
| Dependency vulnerabilities | `npm audit --omit=dev` | 0 after the fix below. |

## Fixed in this review

### 1. Two moderate CVEs in `react-router` (fixed)

`react-router-dom` 6.26 carried an open-redirect bypass in `<Link>`/`useNavigate`
and an arbitrary-constructor-injection issue in SSR hydration.

Real exposure here was low — the app builds only fixed internal paths and does no
SSR — but an unpatched moderate CVE in an application holding NHS coordination
data is not a position worth defending later. Upgraded to `react-router-dom` 7.
All 34 browser checks pass unchanged.

### 2. Edge Function CORS defaulted to `*` (fixed)

`Access-Control-Allow-Origin: *` let any page in any tab invoke the function.
It could not supply a valid JWT, so nothing was readable — but there was no
reason to accept the request at all. Now reflects only origins in
`ALLOWED_ORIGIN`, with `Vary: Origin`. Unset still allows any origin, for local
development; setting it is a documented deployment step.

### 3. Raw Postgres errors returned to the browser (fixed)

Insert failures returned `error.message` straight from PostgREST, which names
columns and constraints. Those are now logged server-side and the client
receives a description of what failed instead of a description of the schema.

### 4. No ceiling on extraction spend (fixed)

Nothing limited how often the extract function could be called. A leaked session
token could have run it in a loop and spent against the Anthropic key without
bound. Added a rolling 24-hour cap per account (`DAILY_INTAKE_LIMIT`, default 40)
— generous for someone pasting meetings by hand, and a hard stop for a loop.

### 5. Prompt injection via pasted transcripts (mitigated)

A meeting record is untrusted input that goes into a prompt. Someone could paste
text containing instructions addressed to the model — "mark everything urgent",
"ignore the previous rules".

Blast radius was already small: the model has no tools and no network access, and
its only output is proposals the user must review before anything is written. But
the source is now explicitly framed as data rather than instruction, delimited in
`<record>` tags, with a rule that anything addressed to the model is meeting
content and never a command.

The structural defence is the one that matters: **extraction cannot write to the
register.** Nothing an injected transcript can produce is more than a proposal
with a visible quote next to it.

## Accepted, with reasoning

**The anon key is public.** It ships in the bundle by design. It is safe because
RLS is enabled and forced on every table with no policy granting anything to
`anon` — proven, not assumed, by `tests/rls.sh`. Verify it yourself once after
deploying, using the `curl` in DEPLOY.md.

**The offline queue uses `localStorage`.** Queued writes are task titles and
notes, not credentials, and they are scoped to the browser origin. On a shared
or unlocked device they are readable like any other open session. Payloads are
small and short-lived; sessions expire normally.

**Transcripts are retained.** `intakes.source_text` keeps the pasted record so
each item can show where it came from. Owner-only and RLS-bound, but it is
retained data — worth naming in any DPIA. There is no automatic expiry; add one
if retention policy requires it.

**Extraction sends text to a third party.** Documented in the README under
Information governance. Opt-in per deployment, nothing sent in the background,
and the screen says so before the button. That is a decision about NHS
information, not a technical control.

## Not applicable

- No SSR, so no hydration attack surface.
- No file upload path.
- No user-supplied HTML or Markdown rendering.
- No secrets in CI: the workflow builds in demo mode and needs no credentials.
