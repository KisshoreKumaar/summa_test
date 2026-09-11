import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type {
  Group,
  GroupCategory,
  GroupMemberWithProfile,
  GroupPostWithMeta,
  GroupWithMembership,
  ProfileSummary,
} from '@/lib/types/database';

const PROFILE_FIELDS = 'id, full_name, avatar_url, year, branch';

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Groups are readable by everyone, so membership has to be layered on with a
 * second query rather than a join filter.
 */
async function decorate(groups: Group[]): Promise<GroupWithMembership[]> {
  if (groups.length === 0) return [];

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ids = groups.map((g) => g.id);

  /*
   * Counts come from group_member_counts(), not from selecting group_members.
   * That table's read policy only exposes rows for groups you already belong
   * to, so counting rows directly reported 0 for every group the viewer had
   * not joined. The RPC is SECURITY DEFINER and returns counts only.
   */
  const [{ data: memberships }, { data: countRows }] = await Promise.all([
    user
      ? supabase
          .from('group_members')
          .select('group_id, role, status')
          .eq('user_id', user.id)
          .in('group_id', ids)
      : Promise.resolve({ data: [] as never[] }),
    supabase.rpc('group_member_counts', { gids: ids }),
  ]);

  const mine = new Map((memberships ?? []).map((m) => [m.group_id, m]));

  const counts = new Map<string, number>(
    ((countRows as { group_id: string; member_count: number }[] | null) ?? []).map((r) => [
      r.group_id,
      r.member_count,
    ]),
  );

  return groups.map((group) => ({
    ...group,
    member_count: counts.get(group.id) ?? 0,
    viewer_role: mine.get(group.id)?.role ?? null,
    viewer_status: mine.get(group.id)?.status ?? null,
  }));
}

export interface GroupFilters {
  q?: string;
  category?: GroupCategory;
  mine?: boolean;
}

export async function listGroups(filters: GroupFilters = {}): Promise<GroupWithMembership[]> {
  const supabase = createClient();

  let query = supabase.from('groups').select('*').order('created_at', { ascending: false });

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  }
  if (filters.category) query = query.eq('category', filters.category);

  const { data } = await query.limit(60);
  const decorated = await decorate((data as Group[]) ?? []);

  return filters.mine ? decorated.filter((g) => g.viewer_status === 'active') : decorated;
}

export const getGroup = cache(async (id: string): Promise<GroupWithMembership | null> => {
  const supabase = createClient();
  const { data } = await supabase.from('groups').select('*').eq('id', id).maybeSingle();
  if (!data) return null;

  const [decorated] = await decorate([data as Group]);
  return decorated ?? null;
});

/** Active roster. RLS returns nothing unless the viewer is a member. */
export async function getGroupMembers(groupId: string): Promise<GroupMemberWithProfile[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('group_members')
    .select(`group_id, user_id, role, status, created_at, profile:profiles(${PROFILE_FIELDS})`)
    .eq('group_id', groupId)
    .eq('status', 'active')
    .order('role', { ascending: true });

  return ((data ?? []) as RawMember[]).flatMap((row) => {
    const profile = one<ProfileSummary>(row.profile);
    return profile ? [{ ...row, profile }] : [];
  }) as GroupMemberWithProfile[];
}

/** Pending join requests — only group admins can read these. */
export async function getPendingMembers(groupId: string): Promise<GroupMemberWithProfile[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('group_members')
    .select(`group_id, user_id, role, status, created_at, profile:profiles(${PROFILE_FIELDS})`)
    .eq('group_id', groupId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  return ((data ?? []) as RawMember[]).flatMap((row) => {
    const profile = one<ProfileSummary>(row.profile);
    return profile ? [{ ...row, profile }] : [];
  }) as GroupMemberWithProfile[];
}

export async function getGroupFeed(groupId: string, limit = 30): Promise<GroupPostWithMeta[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = await supabase
    .from('group_posts')
    .select(
      `*, author:profiles(${PROFILE_FIELDS}),
       group_post_likes(user_id),
       group_post_comments(id)`,
    )
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return ((data ?? []) as RawPost[]).map((row) => ({
    id: row.id,
    group_id: row.group_id,
    author_id: row.author_id,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author: one<ProfileSummary>(row.author),
    like_count: row.group_post_likes?.length ?? 0,
    comment_count: row.group_post_comments?.length ?? 0,
    liked_by_viewer: !!user && (row.group_post_likes ?? []).some((l) => l.user_id === user.id),
  }));
}

export async function getPostComments(postId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from('group_post_comments')
    .select(`id, post_id, author_id, content, created_at, author:profiles(${PROFILE_FIELDS})`)
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  return ((data ?? []) as RawComment[]).map((row) => ({
    ...row,
    author: one<ProfileSummary>(row.author),
  }));
}

/** Groups the signed-in user actively belongs to, for nav and the dashboard. */
export const getMyGroups = cache(async (): Promise<GroupWithMembership[]> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('group_members')
    .select('group:groups(*)')
    .eq('user_id', user.id)
    .eq('status', 'active');

  const groups = ((data ?? []) as { group: Group | Group[] | null }[]).flatMap((row) => {
    const g = one<Group>(row.group);
    return g ? [g] : [];
  });

  return decorate(groups);
});

type RawMember = {
  group_id: string;
  user_id: string;
  role: GroupMemberWithProfile['role'];
  status: GroupMemberWithProfile['status'];
  created_at: string;
  profile: ProfileSummary | ProfileSummary[] | null;
};

type RawPost = {
  id: string;
  group_id: string;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  author: ProfileSummary | ProfileSummary[] | null;
  group_post_likes: { user_id: string }[] | null;
  group_post_comments: { id: string }[] | null;
};

type RawComment = {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author: ProfileSummary | ProfileSummary[] | null;
};
