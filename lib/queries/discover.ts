import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/queries/session';
import type { Notification, Profile, SuggestedPerson } from '@/lib/types/database';

export interface SearchFilters {
  q?: string;
  branches?: string[];
  years?: number[];
  skills?: string[];
  interests?: string[];
  page?: number;
}

export const PAGE_SIZE = 24;

export async function searchProfiles(
  filters: SearchFilters,
): Promise<{ profiles: Profile[]; hasMore: boolean }> {
  const supabase = createClient();
  const page = Math.max(0, filters.page ?? 0);

  const { data, error } = await supabase.rpc('search_profiles', {
    q: filters.q?.trim() || null,
    branches: filters.branches?.length ? filters.branches : null,
    years: filters.years?.length ? filters.years : null,
    skill_tags: filters.skills?.length ? filters.skills : null,
    interest_tags: filters.interests?.length ? filters.interests : null,
    // Fetch one extra row to detect whether another page exists.
    page_limit: PAGE_SIZE + 1,
    page_offset: page * PAGE_SIZE,
  });

  if (error || !data) return { profiles: [], hasMore: false };

  const rows = data as Profile[];
  return { profiles: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE };
}

export const getSuggestedPeople = cache(async (limit = 12): Promise<SuggestedPerson[]> => {
  const supabase = createClient();
  const { data } = await supabase.rpc('suggested_people', { page_limit: limit });
  return (data as SuggestedPerson[]) ?? [];
});

/** Distinct branches actually present in visible profiles, for the filter panel. */
export const getFilterFacets = cache(async (): Promise<{ branches: string[] }> => {
  const supabase = createClient();
  const { data } = await supabase
    .from('profiles')
    .select('branch')
    .not('branch', 'is', null)
    .limit(500);

  const branches = Array.from(
    new Set(((data ?? []) as { branch: string | null }[]).map((r) => r.branch).filter(Boolean)),
  ).sort() as string[];

  return { branches };
});

/**
 * Unread count only. The nav bell renders on every authenticated page, so it
 * must not pull rows and a profile join just to draw a badge.
 */
export const getUnreadNotificationCount = cache(async (): Promise<number> => {
  const supabase = createClient();
  const user = await getSessionUser();
  if (!user) return 0;

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null);

  return count ?? 0;
});

export const getNotifications = cache(
  async (limit = 15): Promise<(Notification & { actor: ActorSummary | null })[]> => {
    const supabase = createClient();
    const user = await getSessionUser();
    if (!user) return [];

    const { data } = await supabase
      .from('notifications')
      .select('*, actor:profiles!notifications_actor_id_fkey(id, full_name, avatar_url)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    return ((data ?? []) as RawNotification[]).map((row) => ({
      ...row,
      actor: Array.isArray(row.actor) ? (row.actor[0] ?? null) : (row.actor ?? null),
    }));
  },
);

export type ActorSummary = Pick<Profile, 'id' | 'full_name' | 'avatar_url'>;

type RawNotification = Notification & { actor: ActorSummary | ActorSummary[] | null };
