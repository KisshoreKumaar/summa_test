import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, ExternalLink, MapPin, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { RsvpButtons } from '@/components/events/rsvp-buttons';
import { EventAdminControls } from '@/components/events/event-admin-controls';
import { CATEGORY_LABEL, isLink, locationLabel } from '@/components/events/event-card';
import { EventTime } from '@/components/events/event-time';
import { getAttendees, getEvent } from '@/lib/queries/events';
import { getCurrentProfile } from '@/lib/queries/profile';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const event = await getEvent(params.id);
  return { title: event?.title ?? 'Event' };
}

export default async function EventPage({ params }: { params: { id: string } }) {
  const [event, profile] = await Promise.all([getEvent(params.id), getCurrentProfile()]);

  if (!event) notFound();
  if (!profile) redirect('/login');

  const attendees = await getAttendees(event.id);
  const past = new Date(event.ends_at ?? event.start_time) < new Date();
  const canManage =
    profile.role === 'super_admin' ||
    (profile.role === 'club_admin' && event.created_by === profile.id);

  const going = attendees.filter((a) => a.status === 'going');
  const interested = attendees.filter((a) => a.status === 'interested');

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-6">
        <Card>
          <CardContent className="py-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-slate-900">{event.title}</h1>
                  <Badge tone={past ? 'slate' : 'brand'}>{CATEGORY_LABEL[event.category]}</Badge>
                  {past && <Badge tone="slate">Finished</Badge>}
                </div>

                <dl className="mt-4 space-y-2 text-sm text-slate-700">
                  <div className="flex items-center gap-2">
                    <dt className="sr-only">When</dt>
                    <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <dd><EventTime start={event.start_time} end={event.end_time} /></dd>
                  </div>

                  {event.location && (
                    <div className="flex items-center gap-2">
                      <dt className="sr-only">Where</dt>
                      <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                      <dd>
                        {isLink(event.location) ? (
                          <a
                            href={event.location}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700"
                          >
                            {locationLabel(event.location)}
                            <ExternalLink className="h-3 w-3" aria-hidden />
                          </a>
                        ) : (
                          event.location
                        )}
                      </dd>
                    </div>
                  )}

                  {event.organiser && (
                    <div className="flex items-center gap-2">
                      <dt className="sr-only">Organiser</dt>
                      <Avatar
                        src={event.organiser.avatar_url}
                        name={event.organiser.full_name}
                        size="xs"
                      />
                      <dd>
                        <Link
                          href={`/profile/${event.organiser.id}`}
                          className="hover:text-brand-600"
                        >
                          {event.organiser.full_name ?? 'Unnamed organiser'}
                        </Link>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              {canManage && <EventAdminControls eventId={event.id} />}
            </div>

            {event.description && (
              <p className="mt-5 whitespace-pre-line border-t border-slate-100 pt-5 text-sm leading-relaxed text-slate-700">
                {event.description}
              </p>
            )}

            {!past && (
              <div className="mt-5 border-t border-slate-100 pt-5">
                <p className="mb-2 text-sm font-medium text-slate-700">Are you going?</p>
                <RsvpButtons eventId={event.id} current={event.viewer_status} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-4">
        <Card>
          <CardContent className="py-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Users className="h-4 w-4 text-slate-400" aria-hidden />
              {event.going_count} going
              {event.interested_count > 0 && (
                <span className="font-normal text-slate-500">
                  · {event.interested_count} interested
                </span>
              )}
            </h2>

            {attendees.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Nobody has responded yet.</p>
            ) : (
              <div className="mt-4 space-y-4">
                <AttendeeGroup label="Going" people={going} />
                <AttendeeGroup label="Interested" people={interested} />
              </div>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

function AttendeeGroup({
  label,
  people,
}: {
  label: string;
  people: { user_id: string; profile: { id: string; full_name: string | null; avatar_url: string | null } }[];
}) {
  if (people.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</h3>
      <ul className="mt-2 space-y-2">
        {people.map(({ user_id, profile }) => (
          <li key={user_id}>
            <Link
              href={`/profile/${profile.id}`}
              className="flex items-center gap-2 text-sm text-slate-700 hover:text-brand-600"
            >
              <Avatar src={profile.avatar_url} name={profile.full_name} size="xs" />
              <span className="truncate">{profile.full_name ?? 'Unnamed student'}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
