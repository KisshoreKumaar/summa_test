'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ConversationSummary } from '@/lib/types/database';

function relativeTime(iso: string | null) {
  if (!iso) return '';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function ConversationList({
  conversations,
  activeId,
  viewerId,
}: {
  conversations: ConversationSummary[];
  activeId?: string;
  viewerId: string;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 p-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations…"
          aria-label="Search conversations"
          leftIcon={<Search className="h-4 w-4" />}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          {conversations.length === 0
            ? 'No conversations yet. Message someone you are connected with, or open a group chat.'
            : `Nothing matches “${query}”.`}
        </p>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {filtered.map((c) => {
            const active = c.conversation_id === activeId;
            const unread = c.unread_count > 0;
            const preview = c.last_message
              ? `${c.last_sender_id === viewerId ? 'You: ' : ''}${c.last_message}`
              : 'No messages yet';

            return (
              <li key={c.conversation_id}>
                <Link
                  href={`/messages/${c.conversation_id}`}
                  className={cn(
                    'flex items-center gap-3 border-b border-slate-100 px-3 py-3 transition-colors',
                    active ? 'bg-brand-50' : 'hover:bg-slate-50',
                  )}
                >
                  <div className="relative shrink-0">
                    {c.type === 'group' ? (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                        <Users className="h-5 w-5" aria-hidden />
                      </span>
                    ) : (
                      <Avatar src={c.avatar_url} name={c.title} size="md" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={cn(
                          'truncate text-sm',
                          unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-800',
                        )}
                      >
                        {c.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-400">
                        {relativeTime(c.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'truncate text-xs',
                          unread ? 'text-slate-700' : 'text-slate-500',
                        )}
                      >
                        {preview}
                      </span>
                      {unread && (
                        <span className="flex h-4 min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
                          {c.unread_count > 9 ? '9+' : c.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
