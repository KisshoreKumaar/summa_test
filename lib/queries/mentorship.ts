import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type {
  Mentor,
  MentorAvailability,
  MentorDirectoryEntry,
  MentorProfile,
  MentorSlotWithBooker,
  MentorshipRequestWithPeople,
  ProfileSummary,
} from '@/lib/types/database';

const PROFILE_FIELDS = 'id, full_name, avatar_url, year, branch';

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export interface MentorFilters {
  q?: string;
  expertise?: string[];
  branches?: string[];
  years?: number[];
  page?: number;
}

export const MENTOR_PAGE_SIZE = 24;

export async function searchMentors(
  filters: MentorFilters = {},
): Promise<{ mentors: MentorDirectoryEntry[]; hasMore: boolean }> {
  const supabase = createClient();
  const page = Math.max(0, filters.page ?? 0);

  const { data } = await supabase.rpc('search_mentors', {
    q: filters.q?.trim() || null,
    expertise_tags: filters.expertise?.length ? filters.expertise : null,
    branches: filters.branches?.length ? filters.branches : null,
    years: filters.years?.length ? filters.years : null,
    page_limit: MENTOR_PAGE_SIZE + 1,
    page_offset: page * MENTOR_PAGE_SIZE,
  });

  const rows = (data as MentorDirectoryEntry[]) ?? [];
  return { mentors: rows.slice(0, MENTOR_PAGE_SIZE), hasMore: rows.length > MENTOR_PAGE_SIZE };
}

/** The signed-in user's own mentor record, if they have opted in. */
export const getMyMentorProfile = cache(async (): Promise<Mentor | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from('mentors').select('*').eq('user_id', user.id).maybeSingle();
  return (data as Mentor) ?? null;
});

/**
 * One mentor by id.
 *
 * This used to fetch the first 60 directory rows and find the match in
 * JavaScript, so mentor 61 onwards 404'd — and no mentor could open their own
 * page, since the directory excludes the caller.
 */
export const getMentor = cache(async (userId: string): Promise<MentorProfile | null> => {
  const supabase = createClient();
  const { data } = await supabase.rpc('get_mentor_profile', { target: userId });
  return ((data as MentorProfile[]) ?? [])[0] ?? null;
});

/** Open future slots for a mentor. Booked ones are hidden by RLS. */
export async function getMentorSlots(mentorId: string): Promise<MentorAvailability[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('mentor_availability')
    .select('*')
    .eq('mentor_id', mentorId)
    .gte('slot_start', new Date().toISOString())
    .order('slot_start', { ascending: true });

  return (data as MentorAvailability[]) ?? [];
}

const REQUEST_SELECT = `
  *,
  mentor:profiles!mentorship_requests_mentor_id_fkey(${PROFILE_FIELDS}),
  mentee:profiles!mentorship_requests_mentee_id_fkey(${PROFILE_FIELDS}),
  slot:mentor_availability(*)
`;

type RawRequest = MentorshipRequestWithPeople & {
  mentor: ProfileSummary | ProfileSummary[] | null;
  mentee: ProfileSummary | ProfileSummary[] | null;
  slot: MentorAvailability | MentorAvailability[] | null;
};

function normalise(rows: unknown): MentorshipRequestWithPeople[] {
  return ((rows ?? []) as RawRequest[]).map((row) => ({
    ...row,
    mentor: one<ProfileSummary>(row.mentor),
    mentee: one<ProfileSummary>(row.mentee),
    slot: one<MentorAvailability>(row.slot),
  }));
}

/** Requests other people have sent to the signed-in user as a mentor. */
export const getIncomingMentorshipRequests = cache(
  async (): Promise<MentorshipRequestWithPeople[]> => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
      .from('mentorship_requests')
      .select(REQUEST_SELECT)
      .eq('mentor_id', user.id)
      .order('created_at', { ascending: false });

    return normalise(data);
  },
);

/** Requests the signed-in user has sent as a mentee. */
export const getOutgoingMentorshipRequests = cache(
  async (): Promise<MentorshipRequestWithPeople[]> => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { data } = await supabase
      .from('mentorship_requests')
      .select(REQUEST_SELECT)
      .eq('mentee_id', user.id)
      .order('created_at', { ascending: false });

    return normalise(data);
  },
);

/** The viewer's live relationship with one mentor, if any. */
export async function getMentorshipWith(
  mentorId: string,
): Promise<MentorshipRequestWithPeople | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('mentorship_requests')
    .select(REQUEST_SELECT)
    .eq('mentor_id', mentorId)
    .eq('mentee_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1);

  return normalise(data)[0] ?? null;
}

/**
 * The signed-in mentor's own slots, with the booker attached. The availability
 * policy already limits booked rows to the mentor and the booker, so nothing
 * extra is exposed here.
 */
export async function getMySlotsWithBookers(): Promise<MentorSlotWithBooker[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('mentor_availability')
    .select(`*, booker:profiles!mentor_availability_booked_by_fkey(${PROFILE_FIELDS})`)
    .eq('mentor_id', user.id)
    .gte('slot_start', new Date().toISOString())
    .order('slot_start', { ascending: true });

  type Raw = MentorAvailability & { booker: ProfileSummary | ProfileSummary[] | null };

  return ((data ?? []) as Raw[]).map((row) => ({
    ...row,
    booker: one<ProfileSummary>(row.booker),
  }));
}
