import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type {
  Conversation,
  ConversationSummary,
  MessageWithSender,
  ProfileSummary,
} from '@/lib/types/database';

const PROFILE_FIELDS = 'id, full_name, avatar_url, year, branch';

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export const listConversations = cache(async (): Promise<ConversationSummary[]> => {
  const supabase = createClient();
  const { data } = await supabase.rpc('list_conversations');
  return (data as ConversationSummary[]) ?? [];
});

export const getUnreadMessageCount = cache(async (): Promise<number> => {
  const conversations = await listConversations();
  return conversations.reduce((total, c) => total + (c.unread_count ?? 0), 0);
});

/** RLS returns nothing unless the viewer participates, which reads as a 404. */
export const getConversation = cache(async (id: string): Promise<Conversation | null> => {
  const supabase = createClient();
  const { data } = await supabase.from('conversations').select('*').eq('id', id).maybeSingle();
  return (data as Conversation) ?? null;
});

export async function getMessages(
  conversationId: string,
  limit = 100,
): Promise<MessageWithSender[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from('messages')
    .select(`*, sender:profiles(${PROFILE_FIELDS})`)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  type Raw = MessageWithSender & { sender: ProfileSummary | ProfileSummary[] | null };

  // Newest-first from the database so the limit takes the most recent, then
  // reversed for display.
  return ((data ?? []) as Raw[])
    .map((row) => ({ ...row, sender: one<ProfileSummary>(row.sender) }))
    .reverse();
}

/** Header details for one conversation, from the same RPC the list uses. */
export async function getConversationSummary(
  conversationId: string,
): Promise<ConversationSummary | null> {
  const all = await listConversations();
  return all.find((c) => c.conversation_id === conversationId) ?? null;
}
