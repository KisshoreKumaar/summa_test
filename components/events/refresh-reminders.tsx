'use client';

import { useEffect, useRef } from 'react';
import { refreshEventRemindersAction } from '@/lib/actions/events';

/**
 * Generates any due event reminders once, after the feed has rendered.
 * The RPC is idempotent, but firing it once per mount keeps it to one call.
 */
export function RefreshReminders() {
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void refreshEventRemindersAction();
  }, []);

  return null;
}
