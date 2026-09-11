import Link from 'next/link';
import { CalendarDays, GraduationCap, HandHeart, LayoutGrid, LogOut, Megaphone, MessageSquare, Search, ShieldCheck, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { getUnreadMessageCount } from '@/lib/queries/messages';
import type { Profile } from '@/lib/types/database';

const LINKS = [
  { href: '/discover', label: 'Discover', Icon: Search },
  { href: '/connections', label: 'Connections', Icon: Users },
  { href: '/groups', label: 'Groups', Icon: LayoutGrid },
  { href: '/mentorship', label: 'Mentorship', Icon: HandHeart },
  { href: '/events', label: 'Events', Icon: CalendarDays },
  { href: '/announcements', label: 'News', Icon: Megaphone },
];

export async function AppNav({ profile }: { profile: Profile }) {
  const unreadMessages = await getUnreadMessageCount();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 pr-2 font-semibold text-slate-900"
          >
            <GraduationCap className="h-6 w-6 text-brand-600" aria-hidden />
            <span className="hidden sm:inline">Student Connect</span>
          </Link>

          <nav className="flex items-center gap-1">
            {LINKS.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            ))}

            <Link
              href="/messages"
              className="relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
            >
              <MessageSquare className="h-4 w-4" aria-hidden />
              <span className="hidden lg:inline">Messages</span>
              {unreadMessages > 0 && (
                <span className="absolute -right-0.5 top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-1">
          {profile.role !== 'student' && (
            <Link
              href="/admin"
              aria-label="Admin panel"
              title="Admin panel"
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-brand-600"
            >
              <ShieldCheck className="h-4 w-4" />
            </Link>
          )}
          <NotificationBell />

          <Link
            href={`/profile/${profile.id}`}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            <Avatar src={profile.avatar_url} name={profile.full_name} size="sm" />
            <span className="hidden max-w-[8rem] truncate lg:inline">
              {profile.full_name ?? 'My profile'}
            </span>
          </Link>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              aria-label="Sign out"
              className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
