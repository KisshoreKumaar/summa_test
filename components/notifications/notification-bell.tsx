import Link from 'next/link';
import { Bell } from 'lucide-react';
import { getUnreadNotificationCount } from '@/lib/queries/discover';

/**
 * Shows the unread count and links to the connections page, where the
 * underlying requests are actioned.
 */
export async function NotificationBell() {
  const unread = await getUnreadNotificationCount();

  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
      className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
    >
      <Bell className="h-4 w-4" aria-hidden />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}
