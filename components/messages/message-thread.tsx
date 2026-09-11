'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { createClient } from '@/lib/supabase';
import { deleteMessageAction } from '@/lib/actions/messages';
import { ReportButton } from '@/components/admin/report-button';
import { cn } from '@/lib/utils';
import type { MessageWithSender } from '@/lib/types/database';

function dayLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function MessageThread({
  conversationId,
  initialMessages,
  viewerId,
  showSenderNames,
}: {
  conversationId: string;
  initialMessages: MessageWithSender[];
  viewerId: string;
  showSenderNames: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const bottomRef = useRef<HTMLDivElement>(null);

  // A server round-trip replaces the list wholesale; keep realtime arrivals.
  useEffect(() => {
    setMessages((current) => {
      const seen = new Set(initialMessages.map((m) => m.id));
      const extras = current.filter((m) => !seen.has(m.id));
      return [...initialMessages, ...extras];
    });
  }, [initialMessages]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const incoming = payload.new as MessageWithSender;

          // The realtime payload has no joined sender, so fetch the profile
          // for anyone we have not rendered yet.
          const { data: sender } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, year, branch')
            .eq('id', incoming.sender_id)
            .maybeSingle();

          setMessages((current) =>
            current.some((m) => m.id === incoming.id)
              ? current
              : [...current, { ...incoming, sender: sender ?? null }],
          );
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const removed = payload.old as { id: string };
          setMessages((current) => current.filter((m) => m.id !== removed.id));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  let lastDay = '';

  return (
    <div className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
      {messages.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-500">
          No messages yet. Say hello.
        </p>
      )}

      {messages.map((message, index) => {
        const mine = message.sender_id === viewerId;
        const day = dayLabel(message.created_at);
        const showDay = day !== lastDay;
        lastDay = day;

        const previous = messages[index - 1];
        const grouped =
          !showDay && previous?.sender_id === message.sender_id &&
          new Date(message.created_at).getTime() -
            new Date(previous.created_at).getTime() < 5 * 60 * 1000;

        return (
          <div key={message.id}>
            {showDay && (
              <div className="my-4 flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-medium text-slate-400">{day}</span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
            )}

            <div className={cn('group flex gap-2', mine ? 'justify-end' : 'justify-start')}>
              {!mine && (
                <div className="w-8 shrink-0">
                  {!grouped && (
                    <Link href={`/profile/${message.sender_id}`}>
                      <Avatar
                        src={message.sender?.avatar_url}
                        name={message.sender?.full_name}
                        size="sm"
                      />
                    </Link>
                  )}
                </div>
              )}

              <div className={cn('max-w-[75%]', mine ? 'flex items-end gap-1' : 'flex items-end gap-1')}>
                {!mine && (
                  <span className="order-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <ReportButton targetType="message" targetId={message.id} compact />
                  </span>
                )}
                {mine && (
                  <form action={deleteMessageAction} className="opacity-0 group-hover:opacity-100">
                    <input type="hidden" name="messageId" value={message.id} />
                    <input type="hidden" name="conversationId" value={conversationId} />
                    <button
                      type="submit"
                      aria-label="Delete message"
                      className="rounded p-1 text-slate-300 transition-colors hover:text-red-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </form>
                )}

                <div>
                  {showSenderNames && !mine && !grouped && (
                    <p className="mb-0.5 text-xs font-medium text-slate-500">
                      {message.sender?.full_name ?? 'Unnamed student'}
                    </p>
                  )}
                  <div
                    className={cn(
                      'rounded-2xl px-3.5 py-2 text-sm',
                      mine
                        ? 'rounded-br-sm bg-brand-600 text-white'
                        : 'rounded-bl-sm bg-white text-slate-800 ring-1 ring-slate-200',
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                  <p
                    className={cn(
                      'mt-0.5 text-[11px] text-slate-400',
                      mine ? 'text-right' : 'text-left',
                    )}
                  >
                    {timeLabel(message.created_at)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}
