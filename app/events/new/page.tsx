import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CreateEventForm } from '@/components/events/create-event-form';
import { getCurrentProfile } from '@/lib/queries/profile';

export const metadata: Metadata = { title: 'Create an event' };

export default async function NewEventPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');

  // The insert policy enforces this too; redirecting is the friendlier half.
  if (profile.role !== 'club_admin' && profile.role !== 'super_admin') {
    redirect('/events');
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Create an event</h1>
      <p className="mt-1 text-sm text-slate-600">
        It will appear in the department-wide events feed straight away.
      </p>
      <div className="mt-6">
        <CreateEventForm userId={profile.id} />
      </div>
    </div>
  );
}
