import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/queries/session';
import type { Profile, ProfilePreview } from '@/lib/types/database';

/** The signed-in user's own profile row. `cache` dedupes it within a render. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = createClient();
  const user = await getSessionUser();

  if (!user) return null;

  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return data ?? null;
});

/**
 * Another user's profile. Returns null when RLS hides the row, which is what
 * the profile page renders as "not found".
 */
export const getProfileById = cache(async (id: string): Promise<Profile | null> => {
  const supabase = createClient();
  const { data } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  return data ?? null;
});

/**
 * Limited view of a profile the viewer is not allowed to see in full.
 *
 * Without this a restricted profile is a dead end: it is invisible, so nobody
 * can send a request, so it can never gain a connection and become visible.
 * Name, avatar, branch, and year are enough to confirm who you are connecting
 * with; everything else stays hidden until the profiles RLS policy admits it.
 */
export const getProfilePreview = cache(async (id: string): Promise<ProfilePreview | null> => {
  const supabase = createClient();
  const { data } = await supabase.rpc('profile_preview', { target: id });
  return data?.[0] ?? null;
});
