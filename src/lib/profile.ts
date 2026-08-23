import { supabase } from './supabase';

/**
 * Make sure the signed-in user has a profile row.
 *
 * Every owned table has a foreign key to profiles, so without this row the
 * first insert fails. There is deliberately no auth trigger creating it —
 * see the note in 0001_schema.sql — so it is done here, where a session
 * exists and the ordinary profiles_self policy applies.
 *
 * Idempotent, and cheap enough to run on every sign-in.
 */
export async function ensureProfile(userId: string, email: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .upsert(
      { id: userId, email, display_name: email.split('@')[0] },
      { onConflict: 'id', ignoreDuplicates: true },
    );
  // A failure here is not fatal on its own: the row usually already exists,
  // created by the seed. Log it so a genuinely broken setup is visible.
  if (error) console.warn('Could not ensure profile row:', error.message);
}
