import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ConversationList } from '@/components/messages/conversation-list';
import { getCurrentProfile } from '@/lib/queries/profile';
import { listConversations } from '@/lib/queries/messages';

export const metadata: Metadata = { title: 'Messages' };

export default async function MessagesPage() {
  const [profile, conversations] = await Promise.all([getCurrentProfile(), listConversations()]);
  if (!profile) redirect('/login');

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-slate-900">Messages</h1>

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        <Card className="h-[calc(100vh-14rem)] overflow-hidden">
          <ConversationList conversations={conversations} viewerId={profile.id} />
        </Card>

        <Card className="hidden items-center justify-center lg:flex">
          <div className="p-10 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <MessageSquare className="h-6 w-6 text-slate-400" aria-hidden />
            </span>
            <h2 className="mt-4 font-semibold text-slate-900">Pick a conversation</h2>
            <p className="mt-1 text-sm text-slate-600">
              Choose someone from the list, or start a new chat from a profile or group.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
