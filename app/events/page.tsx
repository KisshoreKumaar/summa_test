import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EventCard, CATEGORY_LABEL } from '@/components/events/event-card';
import { listEvents } from '@/lib/queries/events';
import { getCurrentProfile } from '@/lib/queries/profile';
import { cn } from '@/lib/utils';
import type { EventCategory } from '@/lib/types/database';

export const metadata: Metadata = { title: 'Events' };

const CATEGORIES: EventCategory[] = [
  'workshop', 'talk', 'competition', 'social', 'sports', 'cultural', 'other',
];

export default async function EventsPage({
  searchParams,
}: {
  searchParams: { category?: string; when?: string };
}) {
  const category = CATEGORIES.includes(searchParams.category as EventCategory)
    ? (searchParams.category as EventCategory)
    : undefined;
  const past = searchParams.when === 'past';

  const [events, profile] = await Promise.all([
    listEvents({ category, past }),
    getCurrentProfile(),
  ]);

  const canPublish = profile?.role === 'club_admin' || profile?.role === 'super_admin';

  const link = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    if (params.category) sp.set('category', params.category);
    if (params.when) sp.set('when', params.when);
    const qs = sp.toString();
    return qs ? `/events?${qs}` : '/events';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Events</h1>
          <p className="mt-1 text-sm text-slate-600">
            Workshops, talks, and everything else happening in your department.
          </p>
        </div>
        {canPublish && (
          <Link href="/events/new">
            <Button size="sm">
              <Plus className="h-4 w-4" aria-hidden />
              Create event
            </Button>
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip href={link({ category: category, when: undefined })} active={!past}>
          Upcoming
        </Chip>
        <Chip href={link({ category: category, when: 'past' })} active={past}>
          Past
        </Chip>
        <span className="mx-1 w-px bg-slate-200" />
        <Chip href={link({ when: past ? 'past' : undefined })} active={!category}>
          All
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            href={link({ category: c, when: past ? 'past' : undefined })}
            active={category === c}
          >
            {CATEGORY_LABEL[c]}
          </Chip>
        ))}
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <CalendarDays className="h-6 w-6 text-slate-400" aria-hidden />
            </span>
            <h2 className="mt-4 font-semibold text-slate-900">
              {past ? 'Nothing in the archive yet' : 'No upcoming events'}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {canPublish
                ? 'Create the first one.'
                : 'Check back soon — admins post events here.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'rounded-full border px-3 py-1 text-xs transition-colors',
        active
          ? 'border-brand-500 bg-brand-50 text-brand-700'
          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50/50',
      )}
    >
      {children}
    </Link>
  );
}
