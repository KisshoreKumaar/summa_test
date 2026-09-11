'use client';

import { useEffect } from 'react';
import { markConversationReadAction } from '@/lib/actions/messages';

/**
 * Marks the thread read after it renders.
 *
 * This used to be awaited inside the page's Server Component, which ran a
 * write and a revalidatePath during render — the wrong layer, and it left the
 * nav badge counting the very messages you were looking at, because
 * listConversations() is request-cached and had already run.
 */
export function MarkConversationRead({
  conversationId,
  unreadCount,
}: {
  conversationId: string;
  unreadCount: number;
}) {
  useEffect(() => {
    if (unreadCount <= 0) return;
    void markConversationReadAction(conversationId);
  }, [conversationId, unreadCount]);

  return null;
}
