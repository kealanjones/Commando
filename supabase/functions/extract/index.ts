/**
 * POST /functions/v1/extract
 *
 * Takes a pasted meeting record and proposes register items from it.
 *
 * Runs server-side for one reason above all others: the Anthropic API key
 * must never reach the browser. The Supabase anon key ships in the bundle
 * and is safe because RLS bounds it; an LLM provider key is not bounded by
 * anything, so it lives here as a function secret and nowhere else.
 *
 * This function never writes to `tasks`. It writes candidates to
 * `intake_items` for the user to triage. Extraction proposes; the user
 * disposes.
 *
 * Auth: the caller's own JWT is forwarded to PostgREST, so every read and
 * write below is bounded by the same RLS policies as the app. No service
 * role key is used.
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.71.0';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk@0.71.0/helpers/zod';
import { z } from 'npm:zod@3.23.8';
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const MODEL = 'claude-opus-5';
const MAX_SOURCE_CHARS = 120_000;

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

// ── what the model must return ──────────────────────────────────────
const Item = z.object({
  title: z
    .string()
    .describe(
      'The action, written as an instruction the user could act on cold in three weeks. ' +
        'Start with a verb. Name the person and the object. Never "follow up" alone.',
    ),
  kind: z
    .enum(['task', 'watch'])
    .describe(
      'task = something the user must do. ' +
        'watch = something they must be aware of but must NOT be pushed to act on: ' +
        'a decision recorded, a risk noted, a piece of context, someone else\'s action, ' +
        'a thing that may become work later. When genuinely unsure, choose watch — ' +
        'a false task nags every morning, a false watch item is merely quiet.',
    ),
  context: z
    .string()
    .nullable()
    .describe('Detail that matters and would otherwise be lost: dates, amounts, constraints. Null if none.'),
  stream_id: z.string().nullable().describe('Must be one of the stream ids given, or null if genuinely unclear.'),
  section_id: z.string().nullable().describe('Must be one of the section ids given, or null if genuinely unclear.'),
  do_now: z.boolean().describe('True only if the meeting made it urgent, not merely important.'),
  due: z
    .string()
    .nullable()
    .describe('YYYY-MM-DD, only if a date was actually stated or is unambiguous from a stated relative date. Never invented.'),
  waiting_on: z.array(z.string()).describe('People named as owing something. Empty if the user owns it outright.'),
  evidence: z
    .string()
    .describe('A short verbatim quote from the source that this item comes from. Must appear in the source.'),
  confidence: z.enum(['high', 'medium', 'low']),
  duplicate_of_title: z
    .string()
    .nullable()
    .describe('If this restates an existing open item, its exact title. Otherwise null.'),
});

const Extraction = z.object({
  summary: z.string().describe('Two or three sentences: what this meeting was and what changed.'),
  items: z.array(Item),
});

// ── prompt ──────────────────────────────────────────────────────────
const SYSTEM = `You read meeting records for the Head of Office to the Director of Organ and Tissue Donation and Transplantation at NHS Blood and Transplant, and turn them into entries in his personal work register.

His register makes one distinction above all others:

- A TASK is something he must do. It appears on his morning list and asks something of him.
- A WATCH item is something he must keep in view but must NOT be pushed to act on today: a decision that was recorded, a risk someone raised, a contract in progress, a restructure he does not control, an action that belongs to somebody else.

Getting this wrong in the direction of "task" is the expensive mistake. A list where everything looks equally urgent is exactly the problem this register exists to solve, and every false task makes it worse. When you are not sure, choose watch.

Rules:

1. Extract only what the source supports. If an action is implied but never agreed, it is a watch item at most. Do not infer work that nobody committed to.
2. Never invent a date. Use "due" only where a date was stated, or where a stated relative date ("by end of next week") resolves unambiguously against the meeting date you are given.
3. Write titles someone could act on cold in three weeks. "Chase Derek for the sponsor list before the Sydney trip" — not "Follow up sponsors".
4. Route every item into one of the streams and sections given. If nothing fits, return null rather than forcing it; the user will place it.
5. Each item needs a short verbatim quote from the source as evidence. If you cannot quote it, do not extract it.
6. Check the list of existing open items. If something restates one, set duplicate_of_title to that exact title — do not silently create a second copy.
7. Ignore pleasantries, scheduling chatter, and anything already done.
8. Prefer fewer, better items. Twelve real ones beat forty that need weeding.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST.' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    return json({ error: 'Extraction is not configured. ANTHROPIC_API_KEY is not set on this function.' }, 503);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not signed in.' }, 401);

  // The caller's own JWT, so every query below is RLS-bounded exactly as
  // it would be from the browser.
  const db = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  const { data: auth, error: authErr } = await db.auth.getUser();
  if (authErr || !auth.user) return json({ error: 'Not signed in.' }, 401);
  const owner = auth.user.id;

  let body: { text?: string; label?: string; meeting_date?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Body must be JSON.' }, 400);
  }

  const text = (body.text ?? '').trim();
  if (text.length < 40) return json({ error: 'That is too short to read. Paste the notes or transcript.' }, 400);
  if (text.length > MAX_SOURCE_CHARS) {
    return json(
      { error: `That is ${text.length.toLocaleString()} characters. Split it — the limit is ${MAX_SOURCE_CHARS.toLocaleString()}.` },
      413,
    );
  }

  // ── grounding: the model routes into real sections, not invented ones ──
  const [{ data: streams }, { data: sections }, { data: openTasks }] = await Promise.all([
    db.from('streams').select('id,title,short').order('position'),
    db.from('sections').select('id,stream_id,title,monitor').is('deleted_at', null).order('position'),
    db.from('tasks').select('id,title,stream_id').eq('kind', 'task').eq('done', false).is('deleted_at', null),
  ]);

  if (!streams?.length || !sections?.length) {
    return json({ error: 'No streams or sections found for this account. Seed the register first.' }, 409);
  }

  const grounding = [
    'STREAMS',
    ...streams.map((s) => `  ${s.id} — ${s.title}`),
    '',
    'SECTIONS (route into these; section_id determines the stream)',
    ...sections.map((s) => `  ${s.id} [${s.stream_id}] — ${s.title}${s.monitor ? ' (monitored, not driven)' : ''}`),
    '',
    'EXISTING OPEN ITEMS (do not duplicate these)',
    ...(openTasks ?? []).map((t) => `  ${t.title}`),
  ].join('\n');

  const meetingDate = body.meeting_date || new Date().toISOString().slice(0, 10);

  const intakeInsert = await db
    .from('intakes')
    .insert({
      owner_id: owner,
      label: body.label?.slice(0, 200) ?? null,
      source_text: text,
      status: 'extracting',
    })
    .select('id')
    .single();

  if (intakeInsert.error) return json({ error: intakeInsert.error.message }, 500);
  const intakeId = intakeInsert.data.id as string;

  const fail = async (message: string, status: number) => {
    await db.from('intakes').update({ status: 'failed', error: message }).eq('id', intakeId);
    return json({ error: message, intake_id: intakeId }, status);
  };

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high', format: zodOutputFormat(Extraction) },
      system: [
        // Stable prefix: identical on every run, so it caches.
        { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
        // Changes only when the register's shape changes, so it caches too.
        { type: 'text', text: grounding, cache_control: { type: 'ephemeral' } },
      ],
      messages: [
        {
          role: 'user',
          // Volatile content last, after the cache breakpoints.
          content: `Meeting date: ${meetingDate}\n${body.label ? `Source: ${body.label}\n` : ''}\n<record>\n${text}\n</record>`,
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return await fail('The model declined to process that text.', 422);
    }

    const parsed = response.parsed_output;
    if (!parsed) return await fail('The model did not return a usable result. Try again.', 502);

    const byTitle = new Map((openTasks ?? []).map((t) => [t.title.toLowerCase(), t.id]));
    const validSections = new Map(sections.map((s) => [s.id, s.stream_id]));

    const rows = parsed.items.map((item, i) => {
      // Never trust routing: a section the model invented is treated as
      // unplaced rather than written into a column with a foreign key.
      const sectionId = item.section_id && validSections.has(item.section_id) ? item.section_id : null;
      const streamId = sectionId
        ? validSections.get(sectionId)!
        : item.stream_id && streams.some((s) => s.id === item.stream_id)
          ? item.stream_id
          : null;

      return {
        intake_id: intakeId,
        owner_id: owner,
        title: item.title.slice(0, 500),
        kind: item.kind,
        context: item.context,
        stream_id: streamId,
        section_id: sectionId,
        do_now: item.do_now,
        due: item.due && /^\d{4}-\d{2}-\d{2}$/.test(item.due) ? item.due : null,
        waiting_on: item.waiting_on ?? [],
        evidence: item.evidence?.slice(0, 1000) ?? null,
        confidence: item.confidence,
        duplicate_of: item.duplicate_of_title
          ? (byTitle.get(item.duplicate_of_title.toLowerCase()) ?? null)
          : null,
        position: i,
      };
    });

    if (rows.length) {
      const { error } = await db.from('intake_items').insert(rows);
      if (error) return await fail(error.message, 500);
    }

    await db
      .from('intakes')
      .update({
        status: 'ready',
        summary: parsed.summary,
        model: MODEL,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        processed_at: new Date().toISOString(),
      })
      .eq('id', intakeId);

    return json({
      intake_id: intakeId,
      summary: parsed.summary,
      count: rows.length,
      tasks: rows.filter((r) => r.kind === 'task').length,
      watch: rows.filter((r) => r.kind === 'watch').length,
      duplicates: rows.filter((r) => r.duplicate_of).length,
    });
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status === 401) return await fail('The Anthropic API key was rejected.', 502);
    if (err.status === 429) return await fail('Rate limited by the Anthropic API. Try again shortly.', 429);
    return await fail(err.message ?? 'Extraction failed.', 502);
  }
});
