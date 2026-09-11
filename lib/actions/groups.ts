'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { fieldErrors } from '@/lib/validation';

export interface GroupActionState {
  errors?: Record<string, string>;
  message?: string;
}

const groupSchema = z.object({
  name: z.string().trim().min(3, 'Name must be at least 3 characters').max(80),
  description: z
    .string()
    .trim()
    .max(500, 'Description must be 500 characters or fewer')
    .transform((v) => (v === '' ? null : v))
    .nullable(),
  type: z.enum(['public', 'private']),
  // 'batch' is deliberately absent: those groups are created by a trigger.
  category: z.enum(['club', 'project', 'interest']),
  cover_url: z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .nullable(),
});

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

export async function createGroupAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const parsed = groupSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    type: formData.get('type') ?? 'public',
    category: formData.get('category') ?? 'interest',
    cover_url: formData.get('cover_url') ?? '',
  });

  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from('groups')
    .insert({ ...parsed.data, created_by: user.id })
    .select('id')
    .single();

  if (error || !data) return { errors: { _form: error?.message ?? 'Could not create the group.' } };

  revalidatePath('/groups');
  redirect(`/groups/${data.id}`);
}

export async function joinGroupAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const groupId = String(formData.get('groupId') ?? '');
  if (!groupId) return { errors: { _form: 'Missing group.' } };

  const { supabase, user } = await requireUser();

  const { data: group } = await supabase
    .from('groups')
    .select('type')
    .eq('id', groupId)
    .maybeSingle();

  if (!group) return { errors: { _form: 'That group no longer exists.' } };

  // Public groups admit immediately; private ones queue for approval. The RLS
  // policy enforces this too, so a forged status is rejected either way.
  const status = group.type === 'public' ? 'active' : 'pending';

  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, user_id: user.id, role: 'member', status });

  if (error) {
    if (error.code === '23505') return { errors: { _form: 'You have already joined or applied.' } };
    return { errors: { _form: error.message } };
  }

  revalidatePath(`/groups/${groupId}`);
  revalidatePath('/groups');
  return { message: status === 'active' ? 'Joined.' : 'Request sent.' };
}

export async function leaveGroupAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const groupId = String(formData.get('groupId') ?? '');
  const { supabase, user } = await requireUser();

  // An owner leaving would strand the group without an administrator.
  const { data: membership } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle();

  /*
   * The delete policy blocks this at the database too. Checking here as well
   * turns a raw RLS rejection into an explanation of what to do about it.
   */
  if (membership?.role === 'owner') {
    return {
      errors: {
        _form: 'You own this group. Transfer ownership to another member before leaving.',
      },
    };
  }

  const { data, error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .select('user_id');

  if (error) return { errors: { _form: error.message } };
  if (!data?.length) return { errors: { _form: 'You are not a member of this group.' } };

  revalidatePath(`/groups/${groupId}`);
  revalidatePath('/groups');
  return { message: 'Left the group.' };
}

export async function respondToJoinRequestAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const groupId = String(formData.get('groupId') ?? '');
  const userId = String(formData.get('userId') ?? '');
  const decision = String(formData.get('decision') ?? '');

  if (decision !== 'approve' && decision !== 'reject') {
    return { errors: { _form: 'Invalid response.' } };
  }

  const { supabase } = await requireUser();

  // `.select()` distinguishes "RLS refused" from "done" — a filtered write is
  // not an error.
  const query =
    decision === 'approve'
      ? supabase
          .from('group_members')
          .update({ status: 'active' })
          .eq('group_id', groupId)
          .eq('user_id', userId)
          .select('user_id')
      : supabase
          .from('group_members')
          .delete()
          .eq('group_id', groupId)
          .eq('user_id', userId)
          .select('user_id');

  const { data, error } = await query;

  if (error) return { errors: { _form: error.message } };
  if (!data?.length) return { errors: { _form: 'You cannot manage that request.' } };

  revalidatePath(`/groups/${groupId}`);
  return { message: decision === 'approve' ? 'Member approved.' : 'Request declined.' };
}

export async function updateMemberRoleAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const groupId = String(formData.get('groupId') ?? '');
  const userId = String(formData.get('userId') ?? '');
  const role = String(formData.get('role') ?? '');

  if (!['admin', 'member'].includes(role)) return { errors: { _form: 'Invalid role.' } };

  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from('group_members')
    .update({ role: role as 'admin' | 'member' })
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .neq('role', 'owner')
    .select('user_id');

  if (error) return { errors: { _form: error.message } };
  if (!data?.length) return { errors: { _form: 'You cannot change that member.' } };

  revalidatePath(`/groups/${groupId}`);
  return { message: 'Role updated.' };
}

export async function transferOwnershipAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const groupId = String(formData.get('groupId') ?? '');
  const userId = String(formData.get('userId') ?? '');

  if (!groupId || !userId) return { errors: { _form: 'Missing group or member.' } };

  const { supabase } = await requireUser();

  /*
   * RLS forbids writing owner rows from application context, so this is the
   * only sanctioned path. The function re-checks that the caller really is the
   * current owner before it changes anything.
   */
  const { error } = await supabase.rpc('transfer_group_ownership', {
    gid: groupId,
    new_owner: userId,
  });

  if (error) return { errors: { _form: error.message } };

  revalidatePath(`/groups/${groupId}`);
  return { message: 'Ownership transferred. You are now an admin of this group.' };
}

export async function removeMemberAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const groupId = String(formData.get('groupId') ?? '');
  const userId = String(formData.get('userId') ?? '');

  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .neq('role', 'owner')
    .select('user_id');

  if (error) return { errors: { _form: error.message } };
  if (!data?.length) return { errors: { _form: 'You cannot remove that member.' } };

  revalidatePath(`/groups/${groupId}`);
  return { message: 'Member removed.' };
}

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

export async function createPostAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const groupId = String(formData.get('groupId') ?? '');
  const content = String(formData.get('content') ?? '').trim();

  if (!content) return { errors: { content: 'Write something first.' } };
  if (content.length > 2000) return { errors: { content: 'Posts are limited to 2000 characters.' } };

  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from('group_posts')
    .insert({ group_id: groupId, author_id: user.id, content });

  if (error) return { errors: { _form: error.message } };

  revalidatePath(`/groups/${groupId}`);
  return { message: 'Posted.' };
}

export async function deletePostAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const postId = String(formData.get('postId') ?? '');
  const groupId = String(formData.get('groupId') ?? '');

  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from('group_posts')
    .delete()
    .eq('id', postId)
    .select('id');

  if (error) return { errors: { _form: error.message } };
  if (!data?.length) return { errors: { _form: 'You cannot delete that post.' } };

  revalidatePath(`/groups/${groupId}`);
  return { message: 'Post deleted.' };
}

export async function toggleLikeAction(formData: FormData): Promise<void> {
  const postId = String(formData.get('postId') ?? '');
  const groupId = String(formData.get('groupId') ?? '');
  const liked = String(formData.get('liked') ?? '') === 'true';

  const { supabase, user } = await requireUser();

  if (liked) {
    await supabase.from('group_post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
  } else {
    await supabase.from('group_post_likes').insert({ post_id: postId, user_id: user.id });
  }

  revalidatePath(`/groups/${groupId}`);
}

export async function addCommentAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const postId = String(formData.get('postId') ?? '');
  const groupId = String(formData.get('groupId') ?? '');
  const content = String(formData.get('content') ?? '').trim();

  if (!content) return { errors: { content: 'Write a comment first.' } };

  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from('group_post_comments')
    .insert({ post_id: postId, author_id: user.id, content });

  if (error) return { errors: { _form: error.message } };

  revalidatePath(`/groups/${groupId}`);
  return { message: 'Comment added.' };
}

export async function deleteCommentAction(formData: FormData): Promise<void> {
  const commentId = String(formData.get('commentId') ?? '');
  const groupId = String(formData.get('groupId') ?? '');

  const { supabase } = await requireUser();
  await supabase.from('group_post_comments').delete().eq('id', commentId);

  revalidatePath(`/groups/${groupId}`);
}
