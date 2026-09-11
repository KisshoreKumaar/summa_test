'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface MessageActionState {
  error?: string;
  message?: string;
}

async function requireUser() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

/** Opens (or reuses) the DM with someone and navigates to it. */
export async function openDirectMessageAction(
  _prev: MessageActionState,
  formData: FormData,
): Promise<MessageActionState> {
  const otherUserId = String(formData.get('userId') ?? '');
  if (!otherUserId) return { error: 'Missing person.' };

  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc('get_or_create_dm', { other_user: otherUserId });

  if (error) return { error: error.message };
  if (!data) return { error: 'Could not open that conversation.' };

  redirect(`/messages/${data}`);
}

export async function openGroupChatAction(
  _prev: MessageActionState,
  formData: FormData,
): Promise<MessageActionState> {
  const groupId = String(formData.get('groupId') ?? '');
  if (!groupId) return { error: 'Missing group.' };

  const { supabase } = await requireUser();

  const { data, error } = await supabase.rpc('get_or_create_group_conversation', { gid: groupId });

  if (error) return { error: error.message };
  if (!data) return { error: 'Could not open the group chat.' };

  redirect(`/messages/${data}`);
}

export async function sendMessageAction(
  _prev: MessageActionState,
  formData: FormData,
): Promise<MessageActionState> {
  const conversationId = String(formData.get('conversationId') ?? '');
  const content = String(formData.get('content') ?? '').trim();

  if (!content) return { error: 'Write something first.' };
  if (content.length > 4000) return { error: 'Messages are limited to 4000 characters.' };

  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: user.id, content });

  if (error) {
    // The send policy refuses once a DM's connection is gone.
    if (error.code === '42501') {
      return { error: 'You can only message people you are connected with.' };
    }
    return { error: error.message };
  }

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath('/messages');
  return { message: 'Sent.' };
}

export async function markConversationReadAction(conversationId: string): Promise<void> {
  const { supabase } = await requireUser();
  await supabase.rpc('mark_conversation_read', { cid: conversationId });
  revalidatePath('/messages');
}

export async function deleteMessageAction(formData: FormData): Promise<void> {
  const messageId = String(formData.get('messageId') ?? '');
  const conversationId = String(formData.get('conversationId') ?? '');

  const { supabase } = await requireUser();
  await supabase.from('messages').delete().eq('id', messageId);

  revalidatePath(`/messages/${conversationId}`);
}
