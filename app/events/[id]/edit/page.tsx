import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { EditEventForm } from '@/components/events/edit-event-form';
import { getEvent } from '@/lib/queries/events';
import { getCurrentProfile } from '@/lib/queries/profile';

export const metadata: Metadata = { title: 'Edit event' };

export default async function EditEventPage({ params }: { params: { id: string } }) {
  const [event, profile] = await Promise.all([getEvent(params.id), getCurrentProfile()]);

  if (!profile) redirect('/login');
  if (!event) notFound();

  // The update policy enforces this too; redirecting is the friendlier half.
  const canManage =
    profile.role === 'super_admin' ||
    (profile.role === 'club_admin' && event.created_by === profile.id);
  if (!canManage) redirect(`/events/${params.id}`);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Edit event</h1>
      <p className="mt-1 text-sm text-slate-600">
        Changes are visible to everyone straight away.
      </p>
      <div className="mt-6">
        <EditEventForm event={event} userId={profile.id} />
      </div>
    </div>
  );
}
