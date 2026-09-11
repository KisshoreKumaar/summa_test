import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type {
  AnnouncementWithAuthor,
  CampusEvent,
  EventCategory,
  EventWithMeta,
  ProfileSummary,
  RsvpStatus,
} from '@/lib/types/database';

const PROFILE_FIELDS = 'id, full_name, avatar_url, year, branch';

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

type RawEvent = CampusEvent & {
  organiser: ProfileSummary | ProfileSummary[] | null;
};

/**
 * Counts come from event_rsvp_counts(), which aggregates in the database.
 * Embedding `event_rsvps(user_id, status)` used to transfer one row per RSVP
 * per card just to call `.length` on it.
 *
 * The viewer's own status is a second, small query: it reads only their rows.
 */
async function decorate(rows: RawEvent[]): Promise<EventWithMeta[]> {
  if (rows.length === 0) return [];

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ids = rows.map((r) => r.id);

  const [{ data: countRows }, { data: mine }] = await Promise.all([
    supabase.rpc('event_rsvp_counts', { event_ids: ids }),
    user
      ? supabase
          .from('event_rsvps')
          .select('event_id, status')
          .eq('user_id', user.id)
          .in('event_id', ids)
      : Promise.resolve({ data: [] as { event_id: string; status: RsvpStatus }[] }),
  ]);

  const counts = new Map(
    ((countRows as EventCountRow[] | null) ?? []).map((r) => [r.event_id, r]),
  );
  const viewer = new Map(
    ((mine as { event_id: string; status: RsvpStatus }[] | null) ?? []).map((r) => [
      r.event_id,
      r.status,
    ]),
  );

  return rows.map((row) => ({
    ...row,
    organiser: one<ProfileSummary>(row.organiser),
    going_count: counts.get(row.id)?.going_count ?? 0,
    interested_count: counts.get(row.id)?.interested_count ?? 0,
    viewer_status: viewer.get(row.id) ?? null,
  }));
}

type EventCountRow = { event_id: string; going_count: number; interested_count: number };

const SELECT = `*, organiser:profiles(${PROFILE_FIELDS})`;

export interface EventFilters {
  category?: EventCategory;
  past?: boolean;
}

export async function listEvents(filters: EventFilters = {}): Promise<EventWithMeta[]> {
  const supabase = createClient();
  const now = new Date().toISOString();

  let query = supabase.from('events').select(SELECT);

  // `ends_at` is coalesce(end_time, start_time), so an event that has started
  // but is still running counts as upcoming rather than past.
  query = filters.past
    ? query.lt('ends_at', now).order('ends_at', { ascending: false })
    : query.gte('ends_at', now).order('start_time', { ascending: true });

  if (filters.category) query = query.eq('category', filters.category);

  const { data } = await query.limit(60);
  return decorate((data ?? []) as RawEvent[]);
}

export const getEvent = cache(async (id: string): Promise<EventWithMeta | null> => {
  const supabase = createClient();
  const { data } = await supabase.from('events').select(SELECT).eq('id', id).maybeSingle();
  if (!data) return null;

  const [decorated] = await decorate([data as RawEvent]);
  return decorated ?? null;
});

/** Attendees who said yes or maybe. Declines are hidden by RLS. */
export async function getAttendees(eventId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from('event_rsvps')
    .select(`user_id, status, profile:profiles(${PROFILE_FIELDS})`)
    .eq('event_id', eventId)
    .neq('status', 'not_going')
    .order('created_at', { ascending: true });

  type Raw = { user_id: string; status: RsvpStatus; profile: ProfileSummary | ProfileSummary[] | null };

  return ((data ?? []) as Raw[]).flatMap((row) => {
    const profile = one<ProfileSummary>(row.profile);
    return profile ? [{ ...row, profile }] : [];
  });
}

/**
 * Next few events the signed-in user said they were going to.
 *
 * The time filter and limit run in the database; this used to pull every RSVP
 * the user had ever made and discard the past ones in JavaScript.
 */
export const getMyUpcomingEvents = cache(async (limit = 3): Promise<EventWithMeta[]> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const now = new Date().toISOString();

  const { data } = await supabase
    .from('event_rsvps')
    .select(`event:events!inner(${SELECT})`)
    .eq('user_id', user.id)
    .eq('status', 'going')
    .gte('events.ends_at', now)
    .order('start_time', { referencedTable: 'events', ascending: true })
    .limit(limit);

  const events = ((data ?? []) as { event: RawEvent | RawEvent[] | null }[]).flatMap((row) => {
    const e = one<RawEvent>(row.event);
    return e ? [e] : [];
  });

  return decorate(events);
});

export async function listAnnouncements(limit = 40): Promise<AnnouncementWithAuthor[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('announcements')
    .select(`*, author:profiles(${PROFILE_FIELDS})`)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  type Raw = AnnouncementWithAuthor & { author: ProfileSummary | ProfileSummary[] | null };

  return ((data ?? []) as Raw[]).map((row) => ({
    ...row,
    author: one<ProfileSummary>(row.author),
  }));
}

/**
 * Titles for a set of event ids, so an event reminder can name the event
 * instead of saying "an event".
 */
export async function getEventTitles(ids: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();

  const supabase = createClient();
  const { data } = await supabase.from('events').select('id, title').in('id', unique);

  return new Map(((data ?? []) as { id: string; title: string }[]).map((e) => [e.id, e.title]));
}
