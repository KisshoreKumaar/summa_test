import Link from 'next/link';
import { CalendarDays, MapPin, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { RsvpButtons } from '@/components/events/rsvp-buttons';
import { EventTime } from '@/components/events/event-time';
import { cn } from '@/lib/utils';
import type { EventCategory, EventWithMeta } from '@/lib/types/database';

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  workshop: 'Workshop',
  talk: 'Talk',
  competition: 'Competition',
  social: 'Social',
  sports: 'Sports',
  cultural: 'Cultural',
  other: 'Other',
};

/** A bare hostname reads better than a full URL on a card. */
export function locationLabel(location: string) {
  try {
    const url = new URL(location);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return location;
  }
}

export function isLink(location: string) {
  return /^https?:\/\//i.test(location);
}

export function EventCard({ event }: { event: EventWithMeta }) {
  const past = new Date(event.ends_at ?? event.start_time) < new Date();

  return (
    <Card className={cn('flex h-full flex-col', past && 'opacity-75')}>
      <CardContent className="flex flex-1 flex-col py-5">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/events/${event.id}`}
            className="min-w-0 flex-1 font-semibold text-slate-900 hover:text-brand-600"
          >
            {event.title}
          </Link>
          <Badge tone={past ? 'slate' : 'brand'}>{CATEGORY_LABEL[event.category]}</Badge>
        </div>

        <dl className="mt-3 space-y-1.5 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <dt className="sr-only">When</dt>
            <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <dd><EventTime start={event.start_time} end={event.end_time} /></dd>
          </div>
          {event.location && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">Where</dt>
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <dd className="truncate">{locationLabel(event.location)}</dd>
            </div>
          )}
          <div className="flex items-center gap-2">
            <dt className="sr-only">Attending</dt>
            <Users className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <dd>
              {event.going_count} going
              {event.interested_count > 0 && ` · ${event.interested_count} interested`}
            </dd>
          </div>
        </dl>

        {event.description && (
          <p className="mt-3 line-clamp-2 text-sm text-slate-600">{event.description}</p>
        )}

        <div className="mt-4 flex-1" />

        {!past && <RsvpButtons eventId={event.id} current={event.viewer_status} size="sm" />}
      </CardContent>
    </Card>
  );
}
