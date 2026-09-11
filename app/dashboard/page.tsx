import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ArrowRight, CalendarDays, HandHeart, LayoutGrid, UserPlus, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { CompletenessCard } from '@/components/profile/completeness-card';
import { PeopleYouMayKnow } from '@/components/discover/people-you-may-know';
import { getCurrentProfile } from '@/lib/queries/profile';
import { getConnections, getPendingRequestCount } from '@/lib/queries/connections';
import { getMyGroups } from '@/lib/queries/groups';
import { getMyUpcomingEvents } from '@/lib/queries/events';
import { getIncomingMentorshipRequests } from '@/lib/queries/mentorship';
import { EventCard } from '@/components/events/event-card';
import { GroupCard } from '@/components/groups/group-card';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  const [connections, pendingCount, myGroups, upcomingEvents, mentorshipRequests] =
    await Promise.all([
    getConnections(),
    getPendingRequestCount(),
    getMyGroups(),
    getMyUpcomingEvents(),
    getIncomingMentorshipRequests(),
  ]);

  const pendingMentorship = mentorshipRequests.filter((r) => r.status === 'requested').length;
  const firstName = profile.full_name?.split(' ')[0] ?? 'there';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome, {firstName}</h1>
        <p className="mt-1 text-sm text-slate-600">
          Here is what is happening in your department.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              href="/connections"
              Icon={Users}
              value={connections.length}
              label={`Connection${connections.length === 1 ? '' : 's'}`}
            />
            <StatCard
              href="/connections?tab=requests"
              Icon={UserPlus}
              value={pendingCount}
              label={`Pending request${pendingCount === 1 ? '' : 's'}`}
              highlight={pendingCount > 0}
            />
            <StatCard
              href="/groups?mine=1"
              Icon={LayoutGrid}
              value={myGroups.length}
              label={`Group${myGroups.length === 1 ? '' : 's'}`}
            />
            <StatCard
              href="/mentorship/requests"
              Icon={HandHeart}
              value={pendingMentorship}
              label={`Mentorship request${pendingMentorship === 1 ? '' : 's'}`}
              highlight={pendingMentorship > 0}
            />
          </div>

          <Card>
            <CardContent className="py-5">
              <h2 className="font-semibold text-slate-900">Find your people</h2>
              <p className="mt-1 text-sm text-slate-600">
                Search students by name, skill, or interest, and filter by branch and year.
              </p>
              <Link
                href="/discover"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Go to Discover
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </CardContent>
          </Card>
        </div>

        <CompletenessCard profile={profile} />
      </div>

      {upcomingEvents.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <CalendarDays className="h-4 w-4 text-brand-600" aria-hidden />
              Your upcoming events
            </h2>
            <Link href="/events" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              See all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </section>
      )}

      {myGroups.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Your groups</h2>
            <Link href="/groups" className="text-sm font-medium text-brand-600 hover:text-brand-700">
              See all
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {myGroups.slice(0, 3).map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        </section>
      )}

      <PeopleYouMayKnow />
    </div>
  );
}

function StatCard({
  href,
  Icon,
  value,
  label,
  highlight,
}: {
  href: string;
  Icon: typeof Users;
  value: number;
  label: string;
  highlight?: boolean;
}) {
  return (
    <Link href={href}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center gap-4 py-5">
          <span
            className={
              highlight
                ? 'flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700'
                : 'flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500'
            }
          >
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
            <p className="text-sm text-slate-600">{label}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
