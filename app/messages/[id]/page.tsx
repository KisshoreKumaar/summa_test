import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { ConversationList } from '@/components/messages/conversation-list';
import { MessageThread } from '@/components/messages/message-thread';
import { MessageComposer } from '@/components/messages/message-composer';
import { MarkConversationRead } from '@/components/messages/mark-conversation-read';
import { getCurrentProfile } from '@/lib/queries/profile';
import {
  getConversation,
  getConversationSummary,
  getMessages,
  listConversations,
} from '@/lib/queries/messages';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const summary = await getConversationSummary(params.id);
  return { title: summary?.title ?? 'Conversation' };
}

export default async function ConversationPage({ params }: { params: { id: string } }) {
  const [profile, conversation] = await Promise.all([
    getCurrentProfile(),
    getConversation(params.id),
  ]);

  if (!profile) redirect('/login');
  // RLS hides conversations the viewer is not part of, so this is a 404.
  if (!conversation) notFound();

  const [conversations, summary, messages] = await Promise.all([
    listConversations(),
    getConversationSummary(params.id),
    getMessages(params.id),
  ]);

  const canPost = await canPostTo(params.id);

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Card className="hidden h-[calc(100vh-10rem)] overflow-hidden lg:block">
          <ConversationList
            conversations={conversations}
            activeId={params.id}
            viewerId={profile.id}
          />
        </Card>

        <Card className="flex h-[calc(100vh-10rem)] flex-col overflow-hidden">
          <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
            <Link
              href="/messages"
              aria-label="Back to conversations"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            {conversation.type === 'group' ? (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <Users className="h-4 w-4" aria-hidden />
              </span>
            ) : (
              <Avatar src={summary?.avatar_url} name={summary?.title} size="md" />
            )}

            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">
                {summary?.title ?? 'Conversation'}
              </p>
              {conversation.type === 'group' && conversation.group_id && (
                <Link
                  href={`/groups/${conversation.group_id}`}
                  className="text-xs text-brand-600 hover:text-brand-700"
                >
                  View group
                </Link>
              )}
              {conversation.type === 'dm' && summary?.other_user_id && (
                <Link
                  href={`/profile/${summary.other_user_id}`}
                  className="text-xs text-brand-600 hover:text-brand-700"
                >
                  View profile
                </Link>
              )}
            </div>
          </header>

          {/* Marking read is a side effect, so it happens after render, not during. */}
          <MarkConversationRead
            conversationId={params.id}
            unreadCount={summary?.unread_count ?? 0}
          />

          <MessageThread
            conversationId={params.id}
            initialMessages={messages}
            viewerId={profile.id}
            showSenderNames={conversation.type === 'group'}
          />

          <MessageComposer
            conversationId={params.id}
            disabled={!canPost}
            disabledReason={
              conversation.type === 'dm'
                ? 'You are no longer connected with this person, so you cannot send new messages.'
                : 'Join this group to take part in the chat.'
            }
          />
        </Card>
      </div>
    </div>
  );
}

/**
 * Mirrors the send policy so the composer can explain itself rather than
 * letting the insert fail after the user has typed something.
 */
async function canPostTo(conversationId: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase.rpc('can_post_to_conversation', { cid: conversationId });
  return data === true;
}
