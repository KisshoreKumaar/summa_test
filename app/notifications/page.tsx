import type { Metadata } from 'next';
import Link from 'next/link';
import { Bell, CalendarClock, GraduationCap, Users, UserCheck, UserPlus } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { markNotificationsRead } from '@/lib/actions/connections';
import { getNotifications } from '@/lib/queries/discover';
import { RefreshReminders } from '@/components/events/refresh-reminders';
import { getEventTitles } from '@/lib/queries/events';
import { cn } from '@/lib/utils';
import type { NotificationType } from '@/lib/types/database';

export const metadata: Metadata = { title: 'Notifications' };

const COPY: Record<
  NotificationType,
  { Icon: typeof UserPlus; text: (name: string) => string; href: (entityId: string | null) => string }
> = {
  connection_request: {
    Icon: UserPlus,
    text: (name) => `${name} sent you a connection request.`,
    href: () => '/connections?tab=requests',
  },
  connection_accepted: {
    Icon: UserCheck,
    text: (name) => `${name} accepted your connection request.`,
    href: () => '/connections',
  },
  group_join_request: {
    Icon: Users,
    text: (name) => `${name} asked to join a group you manage.`,
    href: (id) => (id ? `/groups/${id}` : '/groups'),
  },
  group_join_approved: {
    Icon: Users,
    text: (name) => `${name} approved your request to join a group.`,
    href: (id) => (id ? `/groups/${id}` : '/groups'),
  },
  mentorship_request: {
    Icon: GraduationCap,
    text: (name) => `${name} asked you for mentorship.`,
    href: () => '/mentorship/requests',
  },
  mentorship_accepted: {
    Icon: GraduationCap,
    text: (name) => `${name} accepted your mentorship request.`,
    href: () => '/mentorship/requests',
  },
  event_reminder: {
    Icon: CalendarClock,
    text: () => 'An event you are going to starts within 24 hours.',
    href: (id) => (id ? `/events/${id}` : '/events'),
  },
};

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function NotificationsPage() {
  const notifications = await getNotifications(30);

  const eventTitles = await getEventTitles(
    notifications
      .filter((n) => n.type === 'event_reminder')
      .map((n) => n.entity_id ?? ''),
  );
  const hasUnread = notifications.some((n) => !n.read_at);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
        {hasUnread && (
          <form
            action={async () => {
              'use server';
              await markNotificationsRead();
            }}
          >
            <Button type="submit" variant="ghost" size="sm">
              Mark all read
            </Button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <Bell className="h-6 w-6 text-slate-400" aria-hidden />
            </span>
            <h2 className="mt-4 font-semibold text-slate-900">Nothing yet</h2>
            <p className="mt-1 text-sm text-slate-600">
              Connection requests and acceptances will show up here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {notifications.map((notification) => {
            const { Icon, text, href } = COPY[notification.type];
            const name = notification.actor?.full_name ?? 'Someone';
            const title = eventTitles.get(notification.entity_id ?? '');

            return (
              <li key={notification.id}>
                {/* Every notification now leads somewhere; entity_id was
                    previously stored and never used. */}
                <Link href={href(notification.entity_id)} className="block">
                  <Card
                    className={cn(
                      'transition-shadow hover:shadow-md',
                      !notification.read_at && 'border-brand-200 bg-brand-50/40',
                    )}
                  >
                    <CardContent className="flex items-center gap-3 py-4">
                      <Avatar
                        src={notification.actor?.avatar_url}
                        name={name}
                        size="md"
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-800">
                          {notification.type === 'event_reminder' && title
                            ? `“${title}” starts within 24 hours.`
                            : text(name)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {relativeTime(notification.created_at)}
                        </p>
                      </div>
                      <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <RefreshReminders />

      <p className="text-center text-sm text-slate-500">
        Manage requests on the{' '}
        <Link href="/connections?tab=requests" className="font-medium text-brand-600">
          connections page
        </Link>
        .
      </p>
    </div>
  );
}
