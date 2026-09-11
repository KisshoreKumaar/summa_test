import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarClock, GraduationCap } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { RequestMentorshipForm } from '@/components/mentorship/request-mentorship-form';
import { SlotPicker } from '@/components/mentorship/slot-picker';
import { getMentor, getMentorSlots, getMentorshipWith } from '@/lib/queries/mentorship';
import { getCurrentProfile } from '@/lib/queries/profile';
import { yearLabel } from '@/lib/utils';

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const mentor = await getMentor(params.id);
  return { title: mentor?.full_name ?? 'Mentor' };
}

export default async function MentorPage({ params }: { params: { id: string } }) {
  const [mentor, viewer] = await Promise.all([getMentor(params.id), getCurrentProfile()]);

  if (!viewer) redirect('/login');
  if (!mentor) notFound();

  const [slots, mentorship] = await Promise.all([
    getMentorSlots(params.id),
    getMentorshipWith(params.id),
  ]);

  const subtitle = [yearLabel(mentor.year), mentor.branch].filter(Boolean).join(' · ');
  const accepted = mentorship?.status === 'accepted';
  const openSlots = slots.filter((s) => !s.is_booked);
  const mySlot = slots.find((s) => s.booked_by === viewer.id) ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <Avatar src={mentor.avatar_url} name={mentor.full_name} size="xl" />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">
                  {mentor.full_name ?? 'Unnamed mentor'}
                </h1>
                <Badge tone="brand">
                  <GraduationCap className="mr-1 h-3 w-3" aria-hidden />
                  Mentor
                </Badge>
              </div>
              {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}

              <Link
                href={`/profile/${mentor.user_id}`}
                className="mt-1 inline-block text-sm text-brand-600 hover:text-brand-700"
              >
                View full profile
              </Link>

              {!mentor.is_active && (
                <p className="mt-2 text-sm text-amber-700">
                  This mentor has paused new requests.
                </p>
              )}

              {mentor.bio && (
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                  {mentor.bio}
                </p>
              )}

              {mentor.expertise.length > 0 && (
                <div className="mt-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Can help with
                  </h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {mentor.expertise.map((tag) => (
                      <Badge key={tag} tone="brand">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* A paused mentor's insert policy would refuse anyway; better not to
          offer the form at all than to fail after they have typed. */}
      {mentor.is_active || mentorship ? (
        <RequestMentorshipForm mentorId={mentor.user_id} mentorship={mentorship} />
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-sm text-slate-600">
            {mentor.full_name ?? 'This mentor'} is not taking new requests at the moment.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="py-6">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900">
            <CalendarClock className="h-4 w-4 text-slate-400" aria-hidden />
            Available slots
          </h2>

          {!accepted ? (
            <p className="mt-3 text-sm text-slate-600">
              {openSlots.length > 0
                ? `${openSlots.length} slot${openSlots.length === 1 ? '' : 's'} open. ${mentor.full_name ?? 'This mentor'} has to accept your request before you can book one.`
                : 'No open slots at the moment.'}
            </p>
          ) : (
            <SlotPicker
              mentorId={mentor.user_id}
              slots={openSlots}
              bookedSlot={mySlot}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
