/**
 * Turn a Postgres or PostgREST failure into something worth reading.
 *
 * The raw messages name columns and constraints, which is no use to the
 * person holding the phone. The one that matters most here is 42P01: a table
 * that does not exist means the app has been deployed ahead of its
 * migration, and saying so turns a dead button into a two-minute fix.
 */
export interface WriteError {
  code?: string;
  message?: string;
  details?: string | null;
}

export function describeWriteError(err: WriteError | null | undefined, what: string): string {
  if (!err) return `Could not ${what}.`;

  const code = err.code ?? '';
  const raw = err.message ?? '';

  // Deployed ahead of the migration: the single likeliest cause of a new
  // feature doing nothing at all.
  if (code === '42P01' || /relation .* does not exist/i.test(raw)) {
    const table = raw.match(/relation "(?:public\.)?([a-z_]+)"/i)?.[1];
    return (
      `Could not ${what}: this part of the database is not set up yet` +
      `${table ? ` (no "${table}" table)` : ''}. ` +
      'Run the latest migration in the Supabase SQL editor — see DEPLOY.md step 3.'
    );
  }

  if (code === '42703' || code === 'PGRST204' || /column .* does not exist|could not find the .* column/i.test(raw)) {
    return `Could not ${what}: the database is missing a column this version needs. Run the latest migration — see DEPLOY.md step 3.`;
  }

  if (code === '23505') return `Could not ${what}: that already exists.`;
  if (code === '23503') return `Could not ${what}: it refers to something that is no longer there.`;
  if (code === '42501' || code === 'PGRST301') {
    return `Could not ${what}: you are not allowed to. Try signing out and back in.`;
  }
  if (/fetch|network|failed to/i.test(raw)) {
    return `Could not ${what}: no connection. It will not be saved until you are back online.`;
  }

  return `Could not ${what}: ${raw || 'unknown error'}.`;
}

/**
 * A table the database has not got: Postgres says 42P01, PostgREST says
 * PGRST205 ("not in the schema cache"). Either means a migration to run.
 */
export function missingTable(err: unknown): boolean {
  const e = err as WriteError | null | undefined;
  if (!e) return false;
  return e.code === '42P01' || e.code === 'PGRST205'
    || /relation .* does not exist|could not find the table/i.test(e.message ?? '');
}

/**
 * A column the database has not got: Postgres says 42703, PostgREST (which
 * checks its schema cache before Postgres sees the write) says PGRST204.
 */
export function missingColumn(err: unknown): boolean {
  const e = err as WriteError | null | undefined;
  if (!e) return false;
  return e.code === '42703' || e.code === 'PGRST204'
    || /column .* does not exist|could not find the .* column/i.test(e.message ?? '');
}
